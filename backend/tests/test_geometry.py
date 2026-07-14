from app.pipeline.geometry import segments_intersect, side_of_line, point_in_polygon


def test_crossing_segments_intersect():
    assert segments_intersect((0, 0), (10, 10), (0, 10), (10, 0))


def test_parallel_segments_do_not_intersect():
    assert not segments_intersect((0, 0), (10, 0), (0, 1), (10, 1))


def test_non_touching_segments_do_not_intersect():
    assert not segments_intersect((0, 0), (1, 1), (5, 5), (6, 6))


def test_side_of_line_sign_flips_across_line():
    a, b = (0, 0), (10, 0)
    assert side_of_line((5, 5), a, b) > 0
    assert side_of_line((5, -5), a, b) < 0


def test_point_in_polygon():
    square = [(0, 0), (10, 0), (10, 10), (0, 10)]
    assert point_in_polygon((5, 5), square)
    assert not point_in_polygon((15, 5), square)
