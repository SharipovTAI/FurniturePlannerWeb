#!/bin/bash
# Quick Start Guide for Furniture Planner

echo "================================"
echo "Furniture Planner - Quick Start"
echo "================================"
echo ""

# Navigate to project
cd "d:\studies\4_semester\Project\FurniturePlannerMain\FurniturePlanner"

# Activate virtual environment (Windows)
if [ -d "venv/Scripts" ]; then
    echo "Activating virtual environment..."
    source venv/Scripts/activate
else
    echo "Virtual environment not found. Creating..."
    python -m venv venv
    source venv/Scripts/activate
fi

# Install dependencies
echo "Installing dependencies..."
pip install django djangorestframework django-cors-headers

# Apply migrations
echo "Applying database migrations..."
python manage.py migrate

# Create superuser if doesn't exist
echo "Checking for admin user..."
python manage.py shell << EOF
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'password')
    print("Admin user created: admin / password")
else:
    print("Admin user already exists")
EOF

# Start server
echo ""
echo "Starting development server..."
echo "Access the application at: http://localhost:8000"
echo "Admin panel at: http://localhost:8000/admin"
echo ""
echo "Default admin credentials (if created):"
echo "  Username: admin"
echo "  Password: password"
echo ""

python manage.py runserver 8000
