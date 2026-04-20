from django.contrib import admin
from .models import CustomFurnitureObject, Project, Wall, FurnitureItem


@admin.register(CustomFurnitureObject)
class CustomFurnitureObjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'width', 'height', 'created_at')
    list_filter = ('created_at', 'user')
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'room_width', 'room_height', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at', 'user')
    search_fields = ('name', 'user__username')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Wall)
class WallAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'x', 'y', 'width', 'height', 'bearing')
    list_filter = ('bearing', 'project')
    search_fields = ('name', 'project__name')


@admin.register(FurnitureItem)
class FurnitureItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'project', 'item_type', 'subtype', 'x', 'y', 'created_at')
    list_filter = ('item_type', 'project', 'created_at')
    search_fields = ('name', 'subtype', 'project__name')
    readonly_fields = ('created_at',)
