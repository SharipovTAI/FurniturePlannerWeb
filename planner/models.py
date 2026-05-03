from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


class CustomFurnitureObject(models.Model):
    """User-defined custom furniture objects"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='custom_furnitures')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    width = models.FloatField(validators=[MinValueValidator(0.1)])
    height = models.FloatField(validators=[MinValueValidator(0.1)])
    color = models.CharField(max_length=7, default='#888888')  # Hex color code
    file_path = models.FileField(upload_to='furniture_objects/', null=True, blank=True)  # For 3D models or SVG
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.name}"

    class Meta:
        ordering = ['-created_at']


class Project(models.Model):
    """Furniture planning projects"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    room_width = models.FloatField(default=400)  # Default room width in pixels
    room_height = models.FloatField(default=300)  # Default room height in pixels
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    data = models.JSONField(default=dict)  # Raw furniture placement data

    def __str__(self):
        return f"{self.user.username} - {self.name}"

    class Meta:
        ordering = ['-updated_at']


class Wall(models.Model):
    """Walls in a project"""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='walls')
    name = models.CharField(max_length=255, default='Wall')
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    width = models.FloatField(default=100)
    height = models.FloatField(default=10)
    angle = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(359)])
    bearing = models.BooleanField(default=False)  # Bearing wall cannot be moved
    color = models.CharField(max_length=7, default='#808080')
    z_index = models.IntegerField(default=0)
    visible = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.project.name} - {self.name}"


class FurnitureItem(models.Model):
    """Individual furniture items in a project"""
    ITEM_TYPE_CHOICES = [
        ('preset', 'Preset Furniture'),
        ('custom', 'Custom Object'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='furniture_items')
    custom_object = models.ForeignKey(
        CustomFurnitureObject, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='items'
    )
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default='preset')
    name = models.CharField(max_length=255)
    subtype = models.CharField(max_length=255)  # e.g., 'table', 'chair', 'sofa', etc.
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    z_index = models.IntegerField(default=0)
    width = models.FloatField(default=50)
    height = models.FloatField(default=50)
    angle = models.FloatField(default=0, validators=[MinValueValidator(0), MaxValueValidator(359)])
    color = models.CharField(max_length=7, default='#888888')
    visible = models.BooleanField(default=True)
    locked = models.BooleanField(default=False)
    ignore_overlap = models.BooleanField(default=False)  # Мебель: не считать наложение на другую мебель ошибкой
    comment = models.TextField(blank=True, null=True)  # Текстовая аннотация
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.name} - {self.name}"
