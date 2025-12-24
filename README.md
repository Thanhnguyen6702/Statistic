# Web Thống Kê Chi Tiêu Phòng Trọ

Ứng dụng web quản lý và thống kê chi tiêu của các thành viên trong phòng trọ.

## Tính năng

- **Quản lý chi tiêu**: Thêm, sửa, xóa chi tiêu
- **Phân chia chi tiêu**: Chọn người tham gia cho mỗi khoản chi (mặc định tất cả)
- **Thống kê theo người**: Xem tổng chi, số tiền cần nộp/nhận
- **Lịch sử thay đổi**: Theo dõi mọi thao tác (thêm, sửa, xóa)
- **Xóa lịch sử**: Xóa theo tháng hoặc tất cả
- **Lưu trữ (Archive)**: Bắt đầu kỳ thống kê mới
- **Bảo mật**: Yêu cầu mật khẩu cho sửa/xóa
- **Đăng nhập**: Bảo vệ ứng dụng bằng mật khẩu

## Thông tin đăng nhập

| Mật khẩu mặc định | Cách thay đổi |
|-------------------|---------------|
| `admin123` | Đặt biến môi trường `ADMIN_PASSWORD` |

## Cài đặt

```bash
# Clone repo
git clone <repo-url>
cd Statistic

# Cài đặt dependencies
pip install -r requirements.txt

# Chạy migration (nếu cần)
python migrate.py

# Chạy ứng dụng
python run.py
```

Truy cập: **http://localhost:5001**

## Cấu trúc Project (Clean Architecture)

```
Statistic/
├── run.py                  # Entry point
├── config.py               # Cấu hình (Dev/Prod/Test)
├── migrate.py              # Database migrations
├── requirements.txt
│
└── app/
    ├── __init__.py         # App Factory
    ├── extensions.py       # Flask extensions
    │
    ├── models/             # Database Models
    │   ├── expense.py      # Chi tiêu
    │   ├── history.py      # Lịch sử
    │   └── archive.py      # Lưu trữ
    │
    ├── api/                # API Routes (Blueprints)
    │   ├── auth.py         # Đăng nhập/xuất
    │   ├── expenses.py     # CRUD chi tiêu
    │   ├── stats.py        # Thống kê
    │   ├── history.py      # Lịch sử
    │   └── archive.py      # Lưu trữ
    │
    ├── services/           # Business Logic
    │   ├── expense_service.py
    │   ├── stats_service.py
    │   ├── history_service.py
    │   └── archive_service.py
    │
    ├── utils/              # Helpers
    │   ├── decorators.py   # @login_required, @password_required
    │   └── responses.py    # API responses
    │
    ├── templates/          # HTML
    └── static/             # CSS, JS
```

## API Endpoints

### Authentication
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/login` | Đăng nhập |
| POST | `/api/logout` | Đăng xuất |
| GET | `/api/check-auth` | Kiểm tra đăng nhập |

### Expenses
| Method | Endpoint | Mô tả | Password |
|--------|----------|-------|----------|
| GET | `/api/expenses` | Lấy danh sách | - |
| POST | `/api/expenses` | Thêm mới | - |
| PUT | `/api/expenses/<id>` | Cập nhật | ✅ |
| DELETE | `/api/expenses/<id>` | Xóa | ✅ |

### Statistics
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/stats` | Thống kê tổng quan |
| GET | `/api/stats/people` | Thống kê theo người |
| GET | `/api/stats/people/<name>` | Chi tiết 1 người |

### History & Archive
| Method | Endpoint | Mô tả | Password |
|--------|----------|-------|----------|
| GET | `/api/history` | Lấy lịch sử | - |
| POST | `/api/history/clear` | Xóa lịch sử | ✅ |
| GET | `/api/archive/stats` | Danh sách lưu trữ | - |
| POST | `/api/archive` | Tạo lưu trữ mới | ✅ |

## Cấu hình Database

| Môi trường | Database | Cấu hình |
|------------|----------|----------|
| Development | SQLite | Tự động (dev.db) |
| Production | PostgreSQL | Đặt `DATABASE_URL` |

```bash
# Ví dụ Production
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export ADMIN_PASSWORD="your-secure-password"
python run.py
```

## Deploy

### Heroku / Render
```bash
# Procfile đã sẵn sàng
web: gunicorn run:app
```

### Docker
```bash
docker build -t expense-tracker .
docker run -p 5001:5001 -e ADMIN_PASSWORD=secret expense-tracker
```

## Công nghệ

- **Backend**: Flask, SQLAlchemy
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Frontend**: HTML5, CSS3, Vanilla JS
- **Icons**: Font Awesome 6
