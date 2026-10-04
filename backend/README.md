# EduMath AI - Python FastAPI Backend (AI Core)

Backend dịch vụ AI lõi sử dụng **Python FastAPI** và **Google Generative AI (Gemini 3.8 Flash)** để phân tích ảnh bài làm tự luận viết tay môn Toán và chấm điểm tự động đối chiếu theo barem chuẩn SGK cấp 3 (GDPT 2018).

---

## 1. Cấu trúc thư mục dự án (Full-Stack Structure)

```text
edumath-ai-platform/
│
├── backend/                       # Python FastAPI Backend (AI Core)
│   ├── main.py                    # Ứng dụng FastAPI, API chấm tự luận & prompt Gemini
│   ├── requirements.txt           # Thư viện Python phụ thuộc
│   └── README.md                  # Hướng dẫn chạy và triển khai backend
│
├── src/                           # React Frontend (Giao diện người dùng)
│   ├── components/
│   │   ├── StudentEssayUpload.tsx # Component chụp/upload ảnh bài làm & gọi AI chấm
│   │   ├── ExamStudio.tsx         # Module giáo viên sinh đề thi tự động
│   │   ├── ExamRunner.tsx         # Module học sinh làm bài trắc nghiệm & tự luận
│   │   ├── GradebookReport.tsx    # Báo cáo điểm số & xuất file Excel (.xlsx)
│   │   └── CodeArchitecture.tsx   # Trình xem mã nguồn kiến trúc & tải file
│   ├── App.tsx                    # Điều hướng chính và quản lý trạng thái
│   ├── index.css                  # Tailwind CSS
│   └── main.tsx                   # Điểm khởi động React
│
├── server.ts                      # Node.js/Express server (Vite middleware & proxy)
├── package.json
└── tsconfig.json
```

---

## 2. Chỉ thị đặc biệt cho AI Core (Chấm thi THPT)

Theo yêu cầu nghiêm ngặt của hệ thống thi THPT Việt Nam:
1. **Bám sát Barem điểm**: Chấm chi tiết từng bước (0.25đ, 0.5đ).
2. **Chuẩn SGK cấp 3**: Chỉ công nhận định lý, công thức thuộc chương trình Toán 10, 11, 12 (Bộ sách Chân Trời Sáng Tạo, Kết Nối Tri Thức Với Cuộc Sống, Cánh Diều).
3. **CẤM KIẾN THỨC ĐẠI HỌC**:
   - ❌ Tuyệt đối **không** dùng quy tắc L'Hôpital (L'Hospital) để tính giới hạn.
   - ❌ Tuyệt đối **không** dùng khai triển Taylor, Maclaurin.
   - ❌ Tuyệt đối **không** dùng ma trận, định thức cấp cao, tích phân đường/mặt.
   - Nếu phát hiện bài làm sử dụng phương pháp đại học, AI sẽ đánh dấu `university_method_detected: true` và không cho điểm bước đó.

---

## 3. Hướng dẫn cài đặt và khởi chạy Backend Python

### Bước 1: Tạo môi trường ảo (Virtual Environment)
```bash
cd backend
python -m venv venv

# Kích hoạt trên Linux/macOS:
source venv/bin/activate

# Kích hoạt trên Windows:
venv\Scripts\activate
```

### Bước 2: Cài đặt các thư viện cần thiết
```bash
pip install -r requirements.txt
```

### Bước 3: Cấu hình API Key
Thiết lập biến môi trường `GEMINI_API_KEY`:
```bash
# Linux/macOS
export GEMINI_API_KEY="your-gemini-api-key-here"

# Windows Command Prompt
set GEMINI_API_KEY=your-gemini-api-key-here

# Windows PowerShell
$env:GEMINI_API_KEY="your-gemini-api-key-here"
```

### Bước 4: Khởi chạy FastAPI Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
Tài liệu Swagger UI tương tác sẽ có tại: `http://localhost:8000/docs`

---

## 4. API Endpoints

### `POST /api/v1/grade-math-essay`
Nhận vào URL ảnh bài làm (Firebase Storage) hoặc dữ liệu Base64, kèm theo đề bài và danh sách Barem điểm.

**Ví dụ Body gửi lên (JSON):**
```json
{
  "image_url": "https://firebasestorage.googleapis.com/v0/b/edumath.appspot.com/o/submissions%2F12A8_NguyenVanA.jpg?alt=media",
  "student_name": "Nguyễn Văn A",
  "student_class": "12A8",
  "question_text": "Tìm giá trị lớn nhất và nhỏ nhất của hàm số y = x^3 - 3x + 2 trên đoạn [0; 2].",
  "max_score": 2.0,
  "rubric": [
    {"step_name": "Tập xác định & Đạo hàm", "max_score": 0.5, "description": "Tính y' = 3x^2 - 3"},
    {"step_name": "Nghiệm đạo hàm", "max_score": 0.5, "description": "y' = 0 <=> x = 1 (nhận) hoặc x = -1 (loại)"},
    {"step_name": "Tính giá trị tại các mút", "max_score": 0.5, "description": "y(0) = 2, y(1) = 0, y(2) = 4"},
    {"step_name": "Kết luận Min Max", "max_score": 0.5, "description": "Max = 4 tại x=2; Min = 0 tại x=1"}
  ]
}
```
