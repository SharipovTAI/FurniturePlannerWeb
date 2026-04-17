from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny


def index(request):
    """Serve the main frontend application"""
    return render(request, 'index.html')


@api_view(['GET'])
@permission_classes([AllowAny])
def api_status(request):
    """API status endpoint"""
    return JsonResponse({
        'status': 'ok',
        'message': 'Furniture Planner API is running',
    })
