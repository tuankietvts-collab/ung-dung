"""
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
# Đọc API key từ biến môi trường GEMINI_API_KEY
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("CẢNH BÁO: Chưa cấu hình biến môi trường GEMINI_API_KEY!")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# 3. Định nghĩa Pydantic Schemas
class RubricStep(BaseModel):
    step_number: Optional[int] = Field(default=None, description="Số thứ tự bước")
    step_name: str = Field(..., description="Tên hoặc nội dung bước trong barem")
    max_score: float = Field(..., description="Điểm tối đa của bước (ví dụ: 0.25, 0.5, 1.0)")
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
    exam_title: Optional[str] = Field(
        default="Kiểm tra Toán THPT",
        description="Tên bài thi hoặc chủ đề"
    )
    question_text: str = Field(
        ...,
        description="Nội dung câu hỏi đề bài tự luận"
    )
    max_score: float = Field(
        default=3.0,
        description="Tổng điểm tối đa của câu tự luận"
    )
    rubric: List[RubricStep] = Field(
        ...,
        description="Danh sách các bước trong barem điểm chuẩn"
    )
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
   - Bao gồm: Khảo sát hàm số & đạo hàm cơ bản, nguyên hàm - tích phân Newton-Leibniz cơ bản, 
     hình học không gian cổ điển và phương pháp tọa độ Oxyz, xác suất - tổ hợp cơ bản.

3. TUYỆT ĐỐI CẤM VÀ KHÔNG CÔNG NHẬN PHƯƠNG PHÁP ĐẠI HỌC:
   - TUYỆT ĐỐI KHÔNG CHẤP NHẬN và KHÔNG CHO ĐIỂM nếu học sinh sử dụng kiến thức Đại học:
     + Quy tắc L'Hôpital (L'Hospital) để tính giới hạn hàm số.
     + Khai triển Taylor, Maclaurin.
     + Định thức, ma trận cấp cao ngoài SGK để tính tích có hướng hoặc giải hệ.
     + Tích phân đường, tích phân mặt, chuỗi số, phương trình vi phân ngoài SGK.
   - NẾU PHÁT HIỆN: Đánh dấu `university_method_detected = true`, ghi rõ lý do trong `university_method_details` 
     và KHÔNG CÔNG NHẬN điểm tại bước áp dụng kiến thức Đại học.

4. NHẬN DIỆN CHỮ VIẾT TAY (OCR):
   - Đọc kỹ nét viết tay, các ký hiệu toán học (đạo hàm f'(x), tích phân ∫, căn bậc hai √, phân số, vector).
   - Nếu có đoạn tẩy xóa hoặc không đọc được, ghi rõ nhận xét để học sinh rút kinh nghiệm trình bày.

5. TRẢ VỀ JSON:
   - Trả về kết quả JSON hợp lệ, không bọc markdown ```json.
"""

def download_image_as_base64(image_url: str) -> tuple[str, str]:
    """Tải ảnh từ URL (ví dụ Firebase Storage) và chuyển sang Base64 cùng MIME type."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EduMath-Backend/1.0"
        }
        res = requests.get(image_url, headers=headers, timeout=20)
        res.raise_for_status()
        mime_type = res.headers.get("content-type", "image/jpeg")
        b64 = base64.b64encode(res.content).decode("utf-8")
        return b64, mime_type
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể tải ảnh từ URL: {str(e)}"
        )

# 5. Endpoint chính: Chấm điểm bài tự luận qua ảnh
@app.post("/api/v1/grade-math-essay", response_model=GradeEssayResponse)
async def grade_math_essay(payload: GradeEssayRequest):
    if not client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini Client chưa được cấu hình. Vui lòng thiết lập biến môi trường GEMINI_API_KEY."
        )

    # Lấy dữ liệu ảnh dạng Base64
    image_b64 = ""
    mime_type = payload.mime_type or "image/jpeg"

    if payload.image_base64:
        image_b64 = payload.image_base64
        # Lọc bỏ tiền tố data:image/...;base64, nếu có
        if "base64," in image_b64:
            parts = image_b64.split("base64,")
            image_b64 = parts[1]
            header = parts[0]
            m = re.search(r"data:(.*?);", header)
            if m:
                mime_type = m.group(1)
    elif payload.image_url:
        image_b64, mime_type = download_image_as_base64(payload.image_url)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp ít nhất một trong hai: 'image_url' hoặc 'image_base64'."
        )

    # Chuẩn bị Barem điểm thành chuỗi chi tiết
    rubric_text_lines = []
    for idx, r in enumerate(payload.rubric, start=1):
        rubric_text_lines.append(
            f"Bước {idx}: [{r.step_name}] - Điểm tối đa: {r.max_score}đ. Chi tiết: {r.description}"
        )
    rubric_formatted = "\n".join(rubric_text_lines)

    # Xây dựng prompt người dùng
    user_prompt = f"""
THÔNG TIN BÀI THI:
- Học sinh: {payload.student_name} (Lớp {payload.student_class})
- Đề bài: {payload.question_text}
- Thang điểm tối đa: {payload.max_score} điểm.

BAREM ĐIỂM CHUẨN (CẤP 3 - CHƯƠNG TRÌNH GDPT 2018):
{rubric_formatted}

YÊU CẦU ĐÁNH GIÁ:
1. Đọc và phiên âm toàn bộ chữ viết tay của học sinh (ocr_transcription).
2. Liệt kê các bước giải học sinh đã trình bày (detected_steps).
3. Đối chiếu từng bước của barem: chấm điểm thành phần và nhận xét cụ thể (rubric_evaluation).
4. Kiểm tra nghiêm ngặt xem có sử dụng kiến thức Đại học (L'Hopital, Taylor, v.v.) không.
5. Tổng hợp ưu điểm, lỗi sai cần khắc phục, tổng điểm và lời phê của giáo viên.

Định dạng JSON yêu cầu:
{{
  "ocr_transcription": "...",
  "detected_steps": ["Bước 1: ...", "Bước 2: ..."],
  "rubric_evaluation": [
    {{
      "step_name": "...",
      "max_score": 0.5,
      "awarded_score": 0.5,
      "is_correct": true,
      "comment": "..."
    }}
  ],
  "university_method_detected": false,
  "university_method_details": "",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "total_score": 2.5,
  "max_score": {payload.max_score},
  "final_teacher_note": "..."
}}
"""

    try:
        # Gọi Gemini Multimodal Vision API bằng Google GenAI SDK mới nhất
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=[
                types.Part.from_bytes(
                    data=base64.b64decode(image_b64),
                    mime_type=mime_type,
                ),
                types.Part.from_text(text=user_prompt)
            ],
            config=types.GenerateContentConfig(
                system_instruction=HIGH_SCHOOL_MATH_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,  # Nhiệt độ thấp đảm bảo tính nhất quán cao trong chấm toán
            )
        )

        response_text = response.text or "{}"
        clean_json_str = re.sub(r"^```json\s*", "", response_text.strip(), flags=re.MULTILINE)
        clean_json_str = re.sub(r"```$", "", clean_json_str.strip(), flags=re.MULTILINE)
        
        parsed = json.loads(clean_json_str)

        return GradeEssayResponse(
            success=True,
            student_name=payload.student_name or "Học sinh",
            student_class=payload.student_class or "12A8",
            ocr_transcription=parsed.get("ocr_transcription", ""),
            detected_steps=parsed.get("detected_steps", []),
            rubric_evaluation=parsed.get("rubric_evaluation", []),
            university_method_detected=parsed.get("university_method_detected", False),
            university_method_details=parsed.get("university_method_details", ""),
            strengths=parsed.get("strengths", []),
            weaknesses=parsed.get("weaknesses", []),
            total_score=float(parsed.get("total_score", 0.0)),
            max_score=float(parsed.get("max_score", payload.max_score)),
            final_teacher_note=parsed.get("final_teacher_note", "Bài làm cần cẩn thận hơn.")
        )

    except json.JSONDecodeError as jde:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi phân tích JSON từ AI: {str(jde)}. Dữ liệu thô: {response_text[:300]}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình chấm điểm với Gemini: {str(e)}"
        )

# 6. Endpoint kiểm tra sức khỏe hệ thống
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EduMath AI - Python FastAPI Backend",
        "gemini_sdk": "google-genai",
        "gemini_configured": bool(GEMINI_API_KEY)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
