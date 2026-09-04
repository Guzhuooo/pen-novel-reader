#!/usr/bin/env python3
# 批量触摸注入实验：不同事件形态 + 坐标候选，找运行时认可的组合
import struct, subprocess, time, hashlib

DEV = '/dev/input/event4'

def ev(etype, code, value):
    return struct.pack('<iiHHi', 0, 0, etype, code, value)

def send(seq):
    shell = 'printf "%s" > %s' % (''.join('\\x%02x' % b for b in seq), DEV)
    subprocess.run(['adb', 'shell', shell], check=False, capture_output=True)

def tap_b(x, y, rich):
    down = ev(3, 0x2f, 0) + ev(3, 0x39, 0x1234)
    if rich:
        down += ev(3, 0x30, 1) + ev(3, 0x3a, 5)  # TOUCH_MAJOR + PRESSURE
    down += ev(3, 0x35, x) + ev(3, 0x36, y) + ev(1, 0x14a, 1) + ev(0, 0, 0)
    up = ev(3, 0x2f, 0) + ev(3, 0x39, -1) + ev(1, 0x14a, 0) + ev(0, 0, 0)
    send(down)
    time.sleep(0.08)
    send(up)

def tap_a(x, y):
    # 协议 A：无 SLOT
    down = ev(3, 0x35, x) + ev(3, 0x36, y) + ev(1, 0x14a, 1) + ev(0, 0, 0)
    up = ev(1, 0x14a, 0) + ev(0, 0, 0)
    send(down)
    time.sleep(0.08)
    send(up)

def snap():
    subprocess.run(['adb', 'shell', 'miniapp_cli captureFB /tmp/probe.png'], capture_output=True)
    subprocess.run(['adb', 'pull', '/tmp/probe.png', 'tmp/probe_snap.png'], capture_output=True)
    return hashlib.md5(open('tmp/probe_snap.png', 'rb').read()).hexdigest()[:8]

def mouse_click():
    # EV_REL 鼠标事件（cfg.json 配了 mouse 节点）：移动 + 左键
    seq = ev(2, 0, 50) + ev(2, 1, 30) + ev(0, 0, 0)
    send(seq)
    time.sleep(0.05)
    send(ev(1, 0x110, 1) + ev(0, 0, 0))
    time.sleep(0.06)
    send(ev(1, 0x110, 0) + ev(0, 0, 0))

if __name__ == '__main__':
    base = snap()
    print('baseline', base)
    tests = [
        ('B-rich 127,400', lambda: tap_b(127, 400, True)),
        ('B-plain 400,127', lambda: tap_b(400, 127, False)),
        ('B-plain 700,127', lambda: tap_b(700, 127, False)),
        ('B-plain 640,120', lambda: tap_b(640, 120, False)),
        ('A 127,400', lambda: tap_a(127, 400)),
        ('A 400,127', lambda: tap_a(400, 127)),
        ('mouse-rel', mouse_click),
    ]
    for name, fn in tests:
        fn()
        time.sleep(1.2)
        h = snap()
        print(name, h, 'CHANGED' if h != base else 'same')
        base = h
