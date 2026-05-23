# test_integration.py
import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_room_analytics():
    project = {"walls": [[0,0,400,0,400,300,0,300]], "furniture": []}
    r = requests.post(f"{BASE_URL}/project", json=project)
    assert r.status_code == 200
    project_id = r.json()["id"]

    furniture = {"type": "кровать", "x": 100, "y": 100, "width": 80, "height": 200}
    r2 = requests.post(f"{BASE_URL}/project/{project_id}/furniture", json=furniture)
    assert r2.status_code == 200

    r3 = requests.get(f"{BASE_URL}/project/{project_id}/analytics")
    data = r3.json()
    assert "free_area" in data
    assert "dimensions" in data
    print("Integration test passed")

if __name__ == "__main__":
    test_room_analytics()