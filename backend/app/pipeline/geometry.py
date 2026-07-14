"""Pure 2D geometry used by the violation pipeline (no OpenCV dependency)."""


def side_of_line(p, a, b):
    """Signed cross product: >0 left of a→b, <0 right, 0 collinear."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def segments_intersect(p1, p2, q1, q2):
    """Proper intersection test between segments p1-p2 and q1-q2."""
    d1 = side_of_line(q1, p1, p2)
    d2 = side_of_line(q2, p1, p2)
    d3 = side_of_line(p1, q1, q2)
    d4 = side_of_line(p2, q1, q2)
    return ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0))


def point_in_polygon(p, polygon):
    """Ray-casting point-in-polygon test."""
    x, y = p
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            x_cross = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < x_cross:
                inside = not inside
    return inside
