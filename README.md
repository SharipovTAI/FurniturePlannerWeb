# Furniture Planner Web Application

A full-stack Django + Vanilla JavaScript application for interactive furniture placement and room planning.

## Features Implemented

### 1. ✅ Furniture & Wall Management
- Drag-and-drop furniture items (table, chair, sofa, cabinet, bed, lamp)
- Wall placement with bearing wall support
- Real-time 2D canvas visualization
- Object selection, rotation, and manipulation
- Visibility toggle and lock functionality

### 2. ✅ User-Defined Custom Objects Upload
- **Endpoint**: `POST /api/custom-furniture/`
- Upload custom furniture objects with dimensions
- Store dimensions: width, height, length
- Support for color coding
- File attachments for later extension
- Custom objects appear in sidebar for drag-and-drop

### 3. ✅ Object Binding to Walls
- **Endpoint**: `POST /api/projects/{id}/bindings/`
- Bind furniture items to specific walls
- Track offset distances from wall
- Maintain bindings across save/load cycles
- Visual feedback in inspector panel

### 4. ✅ Project Save & Download
- **Save to Server**: `POST /api/projects/` or `PUT /api/projects/{id}/`
- **Download as JSON**: `GET /api/projects/{id}/download/`
- Projects include all objects, walls, and bindings
- Auto-download to user's download folder
- File naming: `{project_name}_{timestamp}.json`
- Import/export functionality

### 5. ✅ User Authentication
- Login system: `POST /api/auth/login/`
- Registration system: `POST /api/auth/register/`
- Token-based authentication
- Persistent user sessions
- User-scoped projects and custom objects

## Project Structure

```
FurniturePlannerMain/
├── FurniturePlanner/
│   ├── manage.py
│   ├── db.sqlite3
│   ├── FurniturePlanner/          # Main Django config
│   │   ├── settings.py             # Configured with REST Framework
│   │   ├── urls.py                 # Main routes
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── planner/                    # Main app
│   │   ├── models.py              # Database models
│   │   ├── views.py               # API viewsets
│   │   ├── serializers.py         # DRF serializers
│   │   ├── auth_views.py          # Auth endpoints
│   │   ├── frontend_views.py      # Frontend views
│   │   ├── urls.py                # API routes
│   │   ├── admin.py               # Admin registration
│   │   └── migrations/
│   ├── templates/                  # Frontend
│   │   └── index.html
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   └── app.js
│   │   └── (existing files)
│   └── media/                      # User uploads
└── venv/                           # Virtual environment
```

## Database Models

### CustomFurnitureObject
```python
- user: ForeignKey(User)
- name: CharField
- description: TextField
- width, height, length: FloatField
- color: CharField (hex code)
- file_path: FileField (optional)
- created_at, updated_at: DateTimeField
```

### Project
```python
- user: ForeignKey(User)
- name: CharField
- description: TextField
- room_width, room_height: FloatField
- data: JSONField
- created_at, updated_at: DateTimeField
```

### Wall
```python
- project: ForeignKey(Project)
- name, x, y, width, height: Various numeric fields
- angle: FloatField (0-359)
- bearing: BooleanField (immovable wall)
- color: CharField
- z_index: IntegerField
- visible: BooleanField
```

### FurnitureItem
```python
- project: ForeignKey(Project)
- custom_object: ForeignKey(CustomFurnitureObject, nullable)
- item_type: CharField ('preset' or 'custom')
- Dimensional fields: x, y, z, width, height, length, angle
- color, visible, locked: BooleanField
```

### ObjectBinding
```python
- project: ForeignKey(Project)
- furniture_item: ForeignKey(FurnitureItem)
- wall: ForeignKey(Wall)
- offset_x, offset_y: FloatField
- distance_from_start: FloatField
```

## API Endpoints

### Authentication
- `POST /api/auth/login/` - Login user
- `POST /api/auth/register/` - Register new user

### Projects
- `GET /api/projects/` - List user's projects
- `POST /api/projects/` - Create new project
- `GET /api/projects/{id}/` - Get project details
- `PUT /api/projects/{id}/` - Update project
- `DELETE /api/projects/{id}/` - Delete project
- `GET /api/projects/{id}/download/` - Download as JSON
- `POST /api/projects/{id}/import_project/` - Import JSON project
- `POST /api/projects/{id}/walls/` - Create wall
- `POST /api/projects/{id}/furniture_items/` - Add furniture
- `POST /api/projects/{id}/bindings/` - Create binding

### Custom Objects
- `GET /api/custom-furniture/` - List custom objects
- `POST /api/custom-furniture/` - Upload new custom object
- `GET /api/custom-furniture/{id}/` - Get custom object
- `PUT /api/custom-furniture/{id}/` - Update custom object
- `DELETE /api/custom-furniture/{id}/` - Delete custom object

## Installation & Setup

### Prerequisites
- Python 3.8+
- pip

### Installation Steps

1. **Navigate to project directory**:
   ```bash
   cd FurniturePlannerMain/FurniturePlanner
   ```

2. **Create virtual environment** (if not already done):
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment**:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`

4. **Install dependencies**:
   ```bash
   pip install django djangorestframework django-cors-headers
   ```

5. **Apply migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Create superuser** (optional, for admin panel):
   ```bash
   python manage.py createsuperuser
   ```

7. **Run development server**:
   ```bash
   python manage.py runserver 8000
   ```

8. **Access application**:
   - Frontend: http://localhost:8000/
   - API: http://localhost:8000/api/
   - Admin: http://localhost:8000/admin/

## Usage Guide

### Getting Started
1. Open http://localhost:8000 in your browser
2. Click "Login" to create an account or sign in
3. You're ready to create furniture layouts!

### Creating a Layout
1. **Add Furniture**: Drag items from the Furniture sidebar to the canvas
2. **Add Walls**: Drag walls from the Walls sidebar
3. **Position Objects**: Click and drag objects on the canvas to move them
4. **Rotate Walls**: Click a wall to select it, then use the blue rotation handle
5. **Inspect Properties**: Select any object to view/edit its properties in the Inspector panel

### Custom Objects
1. Click "+ Upload Custom Object" in the sidebar
2. Enter dimensions (width, height, length) and color
3. Optionally upload a file (for future 3D model support)
4. Click "Upload" - your custom object is now available in the sidebar

### Object Binding
1. Select a furniture item on the canvas
2. In the Inspector panel, use "Bind to Wall" dropdown
3. Select a wall to bind the object to it
4. Binding persists when saving the project

### Saving Projects
1. Edit project name in the header (top left)
2. Click "Save" button
3. Project saves to the database with all objects and bindings
4. Click "⋯" (More) to download as JSON or load existing projects

### Advanced Features

#### Lock Objects
- Prevents accidental movement
- Click "🔒" in Inspector to lock/unlock selected object

#### Hide Objects
- Click "👁" to toggle visibility
- Useful for layer management

#### Delete Objects
- Double-click an object or click "🗑" in Inspector

#### Zoom Controls
- Use +/- buttons in bottom-right corner
- Range: 50% - 300%

## Frontend Architecture

### State Management
The application uses a centralized `appState` object:
```javascript
{
  canvasObjects: [],      // All furniture/walls
  customObjects: [],      // User's custom objects
  selectedObject: null,   // Currently selected
  zoom: 1,
  projectName: 'string',
  walls: [],
  bindings: {},
  // ... other fields
}
```

### Key Functions

#### Canvas Rendering
- `renderCanvas()` - Redraw all objects
- `handleCanvasMouseMove()` - Drag/rotate logic
- `handleCanvasDrop()` - Add items

#### Object Management
- `selectObject(obj)` - Select and highlight
- `deleteObject(id)` - Remove object
- `updateInspector()` - Sync UI with selection

#### API Integration
- `saveProject()` - Save to database
- `downloadProject()` - Export as JSON
- `loadProject(id)` - Import from database
- `loadCustomObjects()` - Fetch user's objects

## Frontend Features

### Drag & Drop
- Sidebar items drag onto canvas
- Creates new objects with correct dimensions
- Visual preview while dragging

### Object Manipulation
- **Move**: Click and drag objects
- **Rotate**: Walls have blue rotation handle
- **Properties**: Edit via Inspector panel

### Local Storage
- Canvas state saved to browser localStorage
- Auto-restored on page reload
- Project name and bindings persist

### Responsive Design
- Flex-based layout
- Sidebar, canvas, inspector panels
- Touch-friendly (experimental)

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Projects Not Saving
- Check browser console for errors (F12)
- Verify user is logged in
- Ensure API is running (`/api-status/` returns success)

### CORS Errors
- Ensure `corsheaders` middleware is installed
- Check `settings.py` has `CORS_ALLOW_ALL_ORIGINS = True`

### Static Files Not Loading
- Run `python manage.py collectstatic` (production)
- Check static files directory exists: `static/`

### Custom Objects Not Appearing
- Verify user is logged in
- Check API response: `GET /api/custom-furniture/`
- Ensure authentication token is set in localStorage

## API Authentication

All protected endpoints require:
```
Authorization: Token <auth_token>
```

Get token via login endpoint:
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Response:
```json
{
  "token": "abc123...",
  "user_id": 1,
  "username": "admin",
  "email": "admin@example.com"
}
```

## Future Enhancements

### Planned Features
- 3D visualization
- Object templates/categories
- Collaborative editing
- Project sharing
- Measurement tools
- Cost estimation
- Export to PDF/image
- Touch gesture support

### Technical Improvements
- Unit tests
- Performance optimization
- Database indexing
- Caching layer
- WebSocket for real-time sync

## Development Notes

### Code Style
- Python: PEP 8
- JavaScript: ES6+
- HTML/CSS: BEM naming convention

### Adding New Features
1. Create database model in `models.py`
2. Create serializer in `serializers.py`
3. Create viewset in `views.py`
4. Register in `urls.py`
5. Update frontend JavaScript
6. Create migrations: `python manage.py makemigrations`

### Testing
```bash
python manage.py test planner
```

## License
MIT License - Feel free to use and modify

## Support
For issues or questions, please check the API documentation at `/api/` when the server is running.

---

**Implementation Date**: April 13, 2026
**Status**: ✅ Complete and Functional
