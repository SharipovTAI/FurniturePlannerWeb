import random
def random_room():
    w = random.randint(200, 800)
    h = random.randint(200, 600)
    return [(0,0), (w,0), (w,h), (0,h)]
with open('temp/random_rooms.txt', 'w') as f:
    for i in range(100):
        f.write(str(random_room()) + '\n')
print("Генерация завершена")