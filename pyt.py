n = int(input())
count = 0

def friendly_frog(i):
    c = 0
    index = 0
    if i>=c:
        return i
    if i+1<=n and i+2<=n:
        c = 2
        index=2
    elif i+2<=n or i+1<=n:
        c = 1
        index = 1

    
    return c+friendly_frog(index)

print(friendly_frog(n))