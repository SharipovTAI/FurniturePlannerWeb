# временный скрипт для проверки формулы площади многоугольника
def polygon_area_draft(points):
    area = 0
    for i in range(len(points)-1):
        area += points[i][0] * points[i+1][1] - points[i+1][0] * points[i][1]
    return abs(area)/2

test_room = [(0,0), (400,0), (400,300), (0,300)]
print("Draft area:", polygon_area_draft(test_room))
# TODO: проверить на изогнутых комнатах