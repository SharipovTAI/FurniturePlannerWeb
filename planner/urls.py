from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views, auth_views

# Main router
router = DefaultRouter()
router.register(r'custom-furniture', views.CustomFurnitureObjectViewSet, basename='custom-furniture')
router.register(r'projects', views.ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', auth_views.login, name='auth-login'),
    path('auth/register/', auth_views.register, name='auth-register'),
]
