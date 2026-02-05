import os

FILES = {
    ".env": """# Shared environment variables
NODE_ENV=development

# Backend
PORT=3001
JWT_SECRET=change_this_secret
DATABASE_URL=postgresql://user:password@localhost:5432/chessarena
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
DEFAULT_USER_PASSWORD=changeme123

# Frontend
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
""",

    ".env.local": """# Local overrides (DO NOT COMMIT)
JWT_SECRET=local_dev_secret
""",

    ".env.development": """NODE_ENV=development
""",

    ".env.production": """NODE_ENV=production
""",

    ".gitignore": """# =========================
# Node / JS
# =========================
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# =========================
# Build outputs
# =========================
dist/
backend/dist/
build/

# =========================
# Environment files
# =========================
.env
.env.local
.env.development
.env.production

# =========================
# OS / Editor junk
# =========================
.DS_Store
Thumbs.db
.vscode/
.idea/

# =========================
# Logs
# =========================
logs/
*.log

# =========================
# Cache
# =========================
.cache/
.vite/

# =========================
# Testing
# =========================
coverage/

# =========================
# Python (just in case)
# =========================
__pycache__/
*.pyc
"""
}

FOLDERS = [
    "dist",
    "backend/dist"
]

def create_file(path, content):
    if os.path.exists(path):
        print(f"✔ Skipped (already exists): {path}")
    else:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"🆕 Created file: {path}")

def create_folder(path):
    if os.path.exists(path):
        print(f"✔ Skipped folder: {path}")
    else:
        os.makedirs(path)
        print(f"📁 Created folder: {path}")

if __name__ == "__main__":
    print("🔧 Setting up environment & gitignore...\n")

    for file, content in FILES.items():
        create_file(file, content)

    print("\n📦 Setting up folders...\n")

    for folder in FOLDERS:
        create_folder(folder)

    print("\n✅ Project setup complete!")
