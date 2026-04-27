from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
import json
from datetime import datetime

from .models import CustomFurnitureObject, Project, Wall, FurnitureItem
from .serializers import (
    CustomFurnitureObjectSerializer, ProjectDetailSerializer, ProjectListSerializer,
    WallSerializer, FurnitureItemSerializer
)


class CustomFurnitureObjectViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing custom furniture objects.
    Users can upload/download their custom furniture definitions.
    """
    serializer_class = CustomFurnitureObjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CustomFurnitureObject.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        """Upload a custom furniture object"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing furniture planning projects.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProjectDetailSerializer
        return ProjectListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def save_layout(self, request, pk=None):
        """Save the furniture layout to the project"""
        project = self.get_object()
        project.data = request.data.get('data', {})
        project.save()
        return Response({'status': 'Layout saved successfully'})

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download project as JSON file"""
        project = self.get_object()
        
        # Prepare project data
        project_data = {
            'id': project.id,
            'name': project.name,
            'description': project.description,
            'room_width': project.room_width,
            'room_height': project.room_height,
            'created_at': project.created_at.isoformat(),
            'updated_at': project.updated_at.isoformat(),
            'walls': [],
            'furniture_items': [],
        }
        
        # Add walls
        for wall in project.walls.all():
            project_data['walls'].append({
                'id': wall.id,
                'name': wall.name,
                'x': wall.x,
                'y': wall.y,
                'width': wall.width,
                'height': wall.height,
                'angle': wall.angle,
                'bearing': wall.bearing,
                'color': wall.color,
                'z_index': wall.z_index,
                'visible': wall.visible,
            })
        
        # Add furniture items
        for item in project.furniture_items.all():
            project_data['furniture_items'].append({
                'id': item.id,
                'name': item.name,
                'subtype': item.subtype,
                'item_type': item.item_type,
                'x': item.x,
                'y': item.y,
                'z_index': item.z_index,
                'width': item.width,
                'height': item.height,
                'angle': item.angle,
                'color': item.color,
                'visible': item.visible,
                'locked': item.locked,
                'comment': item.comment,
            })
        
        # Create JSON response
        response = HttpResponse(
            json.dumps(project_data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="{project.name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
        return response

    @action(detail=False, methods=['post'])
    def import_project(self, request):
        """Import a project from JSON file"""
        data = request.data
        
        project = Project.objects.create(
            user=request.user,
            name=data.get('name', 'Imported Project'),
            description=data.get('description', ''),
            room_width=data.get('room_width', 400),
            room_height=data.get('room_height', 300),
        )
        
        # Import walls
        wall_map = {}
        for wall_data in data.get('walls', []):
            wall = Wall.objects.create(
                project=project,
                name=wall_data.get('name', 'Wall'),
                x=wall_data.get('x', 0),
                y=wall_data.get('y', 0),
                width=wall_data.get('width', 100),
                height=wall_data.get('height', 10),
                angle=wall_data.get('angle', 0),
                bearing=wall_data.get('bearing', False),
                color=wall_data.get('color', '#808080'),
                z_index=wall_data.get('z_index', 0),
                visible=wall_data.get('visible', True),
            )
            wall_map[wall_data.get('id')] = wall
        
        # Import furniture items
        item_map = {}
        for item_data in data.get('furniture_items', []):
            item = FurnitureItem.objects.create(
                project=project,
                name=item_data.get('name', 'Item'),
                subtype=item_data.get('subtype', 'custom'),
                item_type=item_data.get('item_type', 'preset'),
                x=item_data.get('x', 0),
                y=item_data.get('y', 0),
                z_index=item_data.get('z_index', 0),
                width=item_data.get('width', 50),
                height=item_data.get('height', 50),
                angle=item_data.get('angle', 0),
                color=item_data.get('color', '#888888'),
                visible=item_data.get('visible', True),
                locked=item_data.get('locked', False),
                comment=item_data.get('comment', ''),
            )
            item_map[item_data.get('id')] = item
        

        serializer = self.get_serializer(project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post', 'get'])
    def walls(self, request, pk=None):
        """List or create walls for a project"""
        project = self.get_object()
        
        if request.method == 'POST':
            wall_data = request.data
            wall = Wall.objects.create(
                project=project,
                name=wall_data.get('name', 'Wall'),
                x=wall_data.get('x', 0),
                y=wall_data.get('y', 0),
                width=wall_data.get('width', 100),
                height=wall_data.get('height', 10),
                angle=wall_data.get('angle', 0),
                bearing=wall_data.get('bearing', False),
                color=wall_data.get('color', '#808080'),
            )
            return Response(WallSerializer(wall).data, status=status.HTTP_201_CREATED)
        else:
            walls = project.walls.all()
            return Response(WallSerializer(walls, many=True).data)

    @action(detail=True, methods=['post', 'get'])
    def furniture_items(self, request, pk=None):
        """List or create furniture items for a project"""
        project = self.get_object()
        
        if request.method == 'POST':
            item_data = request.data
            item = FurnitureItem.objects.create(
                project=project,
                name=item_data.get('name', 'Item'),
                subtype=item_data.get('subtype', 'custom'),
                item_type=item_data.get('item_type', 'preset'),
                x=item_data.get('x', 0),
                y=item_data.get('y', 0),
                z_index=item_data.get('z_index', 0),
                width=item_data.get('width', 50),
                height=item_data.get('height', 50),
                angle=item_data.get('angle', 0),
                color=item_data.get('color', '#888888'),
                comment=item_data.get('comment', ''),
            )
            return Response(FurnitureItemSerializer(item).data, status=status.HTTP_201_CREATED)
        else:
            items = project.furniture_items.all()
            return Response(FurnitureItemSerializer(items, many=True).data)
        
    @action(detail=True, methods=['post'])
    def sync_project(self, request, pk=None):
        """Полностью заменяет стены и мебель проекта переданными данными"""
        project = self.get_object()
        data = request.data

        # Удаляем всё существующее
        project.walls.all().delete()
        project.furniture_items.all().delete()

        # Создаём стены
        walls_data = data.get('walls', [])
        for wall_data in walls_data:
            Wall.objects.create(
                project=project,
                name=wall_data.get('name', 'Wall'),
                x=wall_data.get('x', 0),
                y=wall_data.get('y', 0),
                width=wall_data.get('width', 100),
                height=wall_data.get('height', 12),
                angle=wall_data.get('angle', 0),
                bearing=wall_data.get('bearing', False),
                color=wall_data.get('color', '#808080'),
                z_index=wall_data.get('z', 0),
                visible=wall_data.get('visible', True),
            )

        # Создаём мебель
        furniture_data = data.get('furniture', [])
        for item_data in furniture_data:
            FurnitureItem.objects.create(
                project=project,
                name=item_data.get('name', 'Item'),
                subtype=item_data.get('subtype', 'custom'),
                item_type=item_data.get('item_type', 'preset'),
                x=item_data.get('x', 0),
                y=item_data.get('y', 0),
                z_index=item_data.get('z', 0),
                width=item_data.get('width', 50),
                height=item_data.get('height', 50),
                angle=item_data.get('angle', 0),
                color=item_data.get('color', '#888888'),
                visible=item_data.get('visible', True),
                locked=item_data.get('locked', False),
                comment=item_data.get('comment', ''),
            )

        return Response({'status': 'ok'}, status=status.HTTP_200_OK)
