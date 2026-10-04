import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Terminal,
  FolderTree,
  FileCode,
  ShieldAlert,
  Server,
  ExternalLink,
  BookOpen
} from 'lucide-react';

const PYTHON_MAIN_CODE = `"""
EduMath AI - Backend Chấm Bài Tự Luận Toán THPT Bằng Gemini Vision
Sử dụng FastAPI và Google GenAI SDK (gemini-3.8-flash)
Tuân thủ nghiêm ngặt chỉ thị kiến thức SGK cấp 3 (GDPT 2018), cấm phương pháp Đại học.
"""

import os
import re
import json
import base64
from typing import List, Optional
import requests
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# 1. Khởi tạo FastAPI App
app = FastAPI(
    title="EduMath AI - Math Essay Auto-Grading Core",
    description="Backend AI chấm bài thi tự luận môn Toán THPT qua ảnh viết tay, đối chiếu barem điểm SGK cấp 3.",
    version="1.0.0"
)

# Cấu hình CORS để Frontend React kết nối thuận tiện
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Khởi tạo Google GenAI Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# 3. Định nghĩa Pydantic Schemas
class RubricStep(BaseModel):
    step_number: Optional[int] = Field(default=None, description="Số thứ tự bước")
    step_name: str = Field(..., description="Tên bước trong barem")
    max_score: float = Field(..., description="Điểm tối đa của bước (0.25đ, 0.5đ, v.v.)")
    description: Optional[str] = Field(default="", description="Chi tiết tiêu chí đạt điểm của bước")

class GradeEssayRequest(BaseModel):
    image_url: Optional[str] = Field(
        default=None,
        description="Đường dẫn URL ảnh bài làm trên Firebase Storage hoặc Cloud Storage"
    )
    image_base64: Optional[str] = Field(
        default=None,
        description="Dữ liệu ảnh dạng chuỗi Base64 (nếu upload trực tiếp)"
    )
    mime_type: Optional[str] = Field(
        default="image/jpeg",
        description="Định dạng ảnh (image/jpeg, image/png, image/webp)"
    )
    exam_title: Optional[str] = Field(default="Kiểm tra Toán THPT", description="Tên bài thi")
    question_text: str = Field(..., description="Nội dung câu hỏi đề bài tự luận")
    max_score: float = Field(default=3.0, description="Tổng điểm tối đa của câu tự luận")
    rubric: List[RubricStep] = Field(..., description="Danh sách các bước trong barem điểm chuẩn")
    student_name: Optional[str] = Field(default="Học sinh", description="Họ và tên học sinh")
    student_class: Optional[str] = Field(default="12A8", description="Lớp học")

class StepEvaluationResult(BaseModel):
    step_name: str
    max_score: float
    awarded_score: float
    is_correct: bool
    comment: str

class GradeEssayResponse(BaseModel):
    success: bool
    student_name: str
    student_class: str
    ocr_transcription: str
    detected_steps: List[str]
    rubric_evaluation: List[StepEvaluationResult]
    university_method_detected: bool
    university_method_details: str
    strengths: List[str]
    weaknesses: List[str]
    total_score: float
    max_score: float
    final_teacher_note: str

# 4. Prompt Chỉ thị đặc biệt cho AI Core (Nghiêm ngặt)
HIGH_SCHOOL_MATH_SYSTEM_PROMPT = """
Bạn là Trưởng ban Giám khảo Chấm thi môn Toán cấp Trung học Phổ thông (THPT) tại Việt Nam với 20 năm kinh nghiệm.
Nhiệm vụ của bạn là phân tích ảnh bài làm tự luận viết tay của học sinh, đọc chữ viết và công thức toán,
sau đó đối chiếu nghiêm ngặt với BAREM ĐIỂM và quy chuẩn Sách Giáo Khoa (SGK) cấp 3 để chấm điểm.

=== CÁC CHỈ THỊ ĐẶC BIỆT BẮT BUỘC (NGHIÊM NGẶT - CRITICAL) ===
1. BÁM SÁT BAREM ĐIỂM:
   - Chấm điểm chi tiết tới từng 0.25 điểm theo các bước trong barem được cung cấp.
   - Học sinh làm đúng đến bước nào thì cho điểm bước đó. Sai từ bước nào thì không cho điểm các bước phụ thuộc phía sau.

2. PHẠM VI KIẾN THỨC TOÁN HỌC:
   - CHỈ ĐƯỢC PHÉP sử dụng kiến thức, định lý, công thức và phương pháp giải thuộc Sách Giáo Khoa Toán cấp 3 
     (Chương trình GDPT 2018: Bộ sách Kết Nối Tri Thức Với Cuộc Sống, Cánh Diều, Chân Trời Sáng Tạo).

3. TUYỆT ĐỐI CẤM VÀ KHÔNG CÔNG NHẬN PHƯƠNG PHÁP ĐẠI HỌC:
   - TUYỆT ĐỐI KHÔNG CHẤP NHẬN và KHÔNG CHO ĐIỂM nếu học sinh sử dụng kiến thức Đại học:
     + Quy tắc L'Hôpital (L'Hospital) để tính giới hạn hàm số.
     + Khai triển Taylor, Maclaurin.
     + Định thức, ma trận cấp cao ngoài SGK để tính tích có hướng hoặc giải hệ.
     + Tích phân đường, tích phân mặt, chuỗi số, phương trình vi phân ngoài SGK.
   - NẾU PHÁT HIỆN: Đánh dấu university_method_detected = true, ghi rõ lý do trong university_method_details 
     và KHÔNG CÔNG NHẬN điểm tại bước áp dụng kiến thức Đại học.

4. NHẬN DIỆN CHỮ VIẾT TAY (OCR):
   - Đọc kỹ nét viết tay, các ký hiệu toán học (đạo hàm f'(x), tích phân ∫, căn bậc hai √, phân số, vector).

5. TRẢ VỀ JSON:
   - Trả về kết quả JSON hợp lệ, không bọc markdown.
"""

def download_image_as_base64(image_url: str) -> tuple[str, str]:
    try:
        headers = {"User-Agent": "Mozilla/5.0 EduMath-Backend/1.0"}
        res = requests.get(image_url, headers=headers, timeout=20)
        res.raise_for_status()
        mime_type = res.headers.get("content-type", "image/jpeg")
        b64 = base64.b64encode(res.content).decode("utf-8")
        return b64, mime_type
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể tải ảnh từ URL: {str(e)}")

# 5. Endpoint chính: Chấm điểm bài tự luận qua ảnh
@app.post("/api/v1/grade-math-essay", response_model=GradeEssayResponse)
async def grade_math_essay(payload: GradeEssayRequest):
    if not client:
        raise HTTPException(status_code=500, detail="Gemini Client chưa được cấu hình GEMINI_API_KEY.")

    if payload.image_base64:
        image_b64 = payload.image_base64
        mime_type = payload.mime_type or "image/jpeg"
        if "base64," in image_b64:
            parts = image_b64.split("base64,")
            image_b64 = parts[1]
    elif payload.image_url:
        image_b64, mime_type = download_image_as_base64(payload.image_url)
    else:
        raise HTTPException(status_code=400, detail="Cần cung cấp image_url hoặc image_base64.")

    rubric_text_lines = [
        f"Bước {idx}: [{r.step_name}] - Điểm: {r.max_score}đ. Chi tiết: {r.description}"
        for idx, r in enumerate(payload.rubric, start=1)
    ]
    rubric_formatted = "\\n".join(rubric_text_lines)

    user_prompt = f"""
THÔNG TIN BÀI THI:
- Học sinh: {payload.student_name} (Lớp {payload.student_class})
- Đề bài: {payload.question_text}
- Thang điểm tối đa: {payload.max_score} điểm.

BAREM ĐIỂM CHUẨN (CẤP 3 - CHƯƠNG TRÌNH GDPT 2018):
{rubric_formatted}
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=[
            types.Part.from_bytes(data=base64.b64decode(image_b64), mime_type=mime_type),
            types.Part.from_text(text=user_prompt)
        ],
        config=types.GenerateContentConfig(
            system_instruction=HIGH_SCHOOL_MATH_SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.1,
        )
    )

    clean_json_str = (response.text or "{}").replace("'''json", "").replace("'''", "").strip()
    parsed = json.loads(clean_json_str)

    return GradeEssayResponse(
        success=True,
        student_name=payload.student_name,
        student_class=payload.student_class,
        ocr_transcription=parsed.get("ocr_transcription", ""),
        detected_steps=parsed.get("detected_steps", []),
        rubric_evaluation=parsed.get("rubric_evaluation", []),
        university_method_detected=parsed.get("university_method_detected", False),
        university_method_details=parsed.get("university_method_details", ""),
        strengths=parsed.get("strengths", []),
        weaknesses=parsed.get("weaknesses", []),
        total_score=float(parsed.get("total_score", 0.0)),
        max_score=float(parsed.get("max_score", payload.max_score)),
        final_teacher_note=parsed.get("final_teacher_note", "Hoàn thành bài thi.")
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;

const PROJECT_STRUCTURE_TEXT = `
edumath-ai-platform/
│
├── backend/                       # Python FastAPI Backend (AI Core)
│   ├── main.py                    # FastAPI server & Gemini Vision prompt
│   ├── requirements.txt           # Thư viện: fastapi, uvicorn, google-genai, pydantic
│   └── README.md                  # Hướng dẫn chạy uvicorn & cấu hình biến môi trường
│
├── src/                           # React Frontend (Giao diện người dùng)
│   ├── components/
│   │   ├── StudentEssayUpload.tsx # [Yêu cầu] Chụp/upload ảnh bài làm & gọi API chấm
│   │   ├── TeacherExamStudio.tsx  # Module giáo viên sinh đề thi tự động
│   │   ├── StudentExamRoom.tsx    # Module học sinh làm trắc nghiệm & tự luận
│   │   ├── GradebookReport.tsx    # Báo cáo điểm số & xuất file Excel (.xlsx)
│   │   └── BackendCodeViewer.tsx  # Trình xem kiến trúc & tải mã nguồn Python
│   ├── types/exam.ts              # Định nghĩa dữ liệu TypeScript
│   ├── services/api.ts            # Gọi API chấm bài, sinh đề thi & xuất file Excel
│   ├── App.tsx                    # Điều hướng chính và điều khiển ứng dụng
│   └── index.css                  # Tailwind CSS
│
├── server.ts                      # Node/Express server (Vite middleware & proxy)
├── package.json
└── tsconfig.json
`;

interface BackendCodeViewerProps {
  backendUrl: string;
  onBackendUrlChange: (url: string) => void;
}

export const BackendCodeViewer: React.FC<BackendCodeViewerProps> = ({
  backendUrl,
  onBackendUrlChange,
}) => {
  const [copiedPython, setCopiedPython] = useState(false);
  const [copiedStructure, setCopiedStructure] = useState(false);
  const [activeTab, setActiveTab] = useState<'main_py' | 'structure' | 'requirements'>('main_py');

  const copyCode = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2 border border-emerald-500/20">
              <Server className="w-3.5 h-3.5" /> Python FastAPI & AI Multimodal Core
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              Kiến Trúc Hệ Thống & Mã Nguồn Python Backend
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Toàn bộ mã nguồn Python FastAPI độc lập để triển khai AI Core trên server riêng, Docker, hoặc Google Cloud Run. Tuân thủ 100% chỉ thị chấm bài thi THPT chuẩn SGK GDPT 2018.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile(PYTHON_MAIN_CODE, 'main.py')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Tải file main.py
            </button>
          </div>
        </div>

        {/* Backend Endpoint Switcher */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-300">
            <span className="font-semibold text-white">Chế độ kết nối AI Core:</span>{' '}
            {backendUrl ? (
              <span className="text-emerald-400 font-mono">Đang trỏ tới: {backendUrl}</span>
            ) : (
              <span className="text-sky-400">Server nội bộ AI Studio (Chạy trực tiếp ngay trên App)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="http://localhost:8000/api/v1/grade-math-essay"
              value={backendUrl}
              onChange={(e) => onBackendUrlChange(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono w-64 focus:outline-none focus:border-indigo-500"
            />
            {backendUrl && (
              <button
                type="button"
                onClick={() => onBackendUrlChange('')}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Đặt lại mặc định
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('main_py')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'main_py'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" /> backend/main.py (FastAPI Code)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('structure')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'structure'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" /> Cấu Trúc Thư Mục Dự Án
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requirements')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'requirements'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> requirements.txt & Cách chạy
        </button>
      </div>

      {/* Code Display Area */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
        {/* Code Header */}
        <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="font-mono text-slate-300 ml-2">
              {activeTab === 'main_py'
                ? 'backend/main.py'
                : activeTab === 'structure'
                ? 'project_structure.txt'
                : 'backend/requirements.txt'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'main_py') copyCode(PYTHON_MAIN_CODE, setCopiedPython);
              else if (activeTab === 'structure') copyCode(PROJECT_STRUCTURE_TEXT, setCopiedStructure);
              else copyCode('fastapi>=0.110.0\nuvicorn[standard]>=0.28.0\ngoogle-genai>=2.4.0\npydantic>=2.6.0\nrequests>=2.31.0', setCopiedStructure);
            }}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {copiedPython || copiedStructure ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã sao chép!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Sao chép mã
              </>
            )}
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[600px] leading-relaxed select-text">
          <code>
            {activeTab === 'main_py' && PYTHON_MAIN_CODE}
            {activeTab === 'structure' && PROJECT_STRUCTURE_TEXT}
            {activeTab === 'requirements' &&
              `# backend/requirements.txt
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
google-genai>=2.4.0
pydantic>=2.6.0
requests>=2.31.0
python-multipart>=0.0.9
pillow>=10.2.0
openpyxl>=3.1.2
python-dotenv>=1.0.0

# Cách cài đặt & chạy server trên máy hoặc cloud:
# 1. cd backend
# 2. pip install -r requirements.txt
# 3. export GEMINI_API_KEY="your-gemini-key"
# 4. uvicorn main:app --host 0.0.0.0 --port 8000 --reload
`}
          </code>
        </pre>
      </div>

      {/* Strict Prompt Explanation Card */}
      <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-2xl text-xs space-y-2">
        <h4 className="font-bold text-amber-900 flex items-center gap-2 text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          Giải Thích Ràng Buộc Nghiêm Ngặt Trong Mã Nguồn AI Core (Prompt Engineering):
        </h4>
        <p className="text-amber-950 leading-relaxed">
          1. <b>Bám sát barem điểm:</b> AI được chỉ thị không tự ý phỏng đoán mà phải phân tích cụ thể từng bước nhỏ (0.25đ, 0.5đ). Nếu sai một bước dẫn tới các bước sau sai theo thì kiên quyết trừ điểm.
        </p>
        <p className="text-amber-950 leading-relaxed">
          2. <b>Chỉ công nhận SGK cấp 3 (GDPT 2018):</b> Giới hạn rõ ràng trong các bộ sách Kết Nối Tri Thức, Cánh Diều, Chân Trời Sáng Tạo.
        </p>
        <p className="text-amber-950 leading-relaxed">
          3. <b>Cấm tuyệt đối kiến thức Đại học:</b> Khi học sinh áp dụng quy tắc L'Hôpital để tính giới hạn, khai triển Taylor/Maclaurin, ma trận hay tích phân đường/mặt, Gemini được cấu hình bắt buộc phải gắn cờ vi phạm (<code>university_method_detected = true</code>) và từ chối cho điểm bước đó.
        </p>
      </div>
    </div>
  );
};
