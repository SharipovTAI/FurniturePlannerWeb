from rest_framework import serializers
from .models import CustomFurnitureObject, Project, Wall, FurnitureItem


class CustomFurnitureObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFurnitureObject
        fields = ['id', 'name', 'description', 'width', 'height', 'color', 'file_path', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WallSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wall
        fields = ['id', 'name', 'x', 'y', 'width', 'height', 'angle', 'bearing', 'color', 'z_index', 'visible']
        read_only_fields = ['id']


class FurnitureItemSerializer(serializers.ModelSerializer):
    custom_object = CustomFurnitureObjectSerializer(read_only=True)

    class Meta:
        model = FurnitureItem
        fields = ['id', 'name', 'subtype', 'item_type', 'custom_object', 'x', 'y', 'z_index', 
                  'width', 'height', 'angle', 'color', 'visible', 'locked', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProjectDetailSerializer(serializers.ModelSerializer):
    walls = WallSerializer(many=True, read_only=True)
    furniture_items = FurnitureItemSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'room_width', 'room_height', 
                  'walls', 'furniture_items', 'data', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'room_width', 'room_height', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
