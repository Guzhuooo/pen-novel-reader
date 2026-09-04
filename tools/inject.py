#!/usr/bin/env python3
# 向词典笔 /dev/input/event4 注入触摸事件（root，evdev 协议 B）
# 用法: python tools/inject.py tap RAW_X RAW_Y
import struct, subprocess, sys, time

DEV = '/dev/input/event4'

def ev(etype, code, value):
    return struct.pack('<iiHHi', 0, 0, etype, code, value)

def tap(x, y):
    down = (
        ev(3, 0x2f, 0)        # ABS_MT_SLOT 0
        + ev(3, 0x39, 0x1234)  # TRACKING_ID
        + ev(3, 0x35, x)       # POSITION_X
        + ev(3, 0x36, y)       # POSITION_Y
        + ev(1, 0x14a, 1)      # BTN_TOUCH down
        + ev(0, 0, 0)          # SYN_REPORT
    )
    up = (
        ev(3, 0x2f, 0)
        + ev(3, 0x39, -1)
        + ev(1, 0x14a, 0)
        + ev(0, 0, 0)
    )
    shell = 'printf "%s" > %s' % (''.join('\\x%02x' % b for b in down), DEV)
    subprocess.run(['adb', 'shell', shell], check=False)
    time.sleep(0.08)
    shell = 'printf "%s" > %s' % (''.join('\\x%02x' % b for b in up), DEV)
    subprocess.run(['adb', 'shell', shell], check=False)

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'tap':
        tap(int(sys.argv[2]), int(sys.argv[3]))
        print('tapped', sys.argv[2], sys.argv[3])
    elif cmd == 'swipe':
        x1, y1, x2, y2 = map(int, sys.argv[2:6])
        steps = 8
        for i in range(steps + 1):
            x = x1 + (x2 - x1) * i // steps
            y = y1 + (y2 - y1) * i // steps
            if i == 0:
                seq = (ev(3, 0x2f, 0) + ev(3, 0x39, 0x2222) + ev(3, 0x35, x) + ev(3, 0x36, y) + ev(1, 0x14a, 1) + ev(0, 0, 0))
            else:
                seq = (ev(3, 0x35, x) + ev(3, 0x36, y) + ev(0, 0, 0))
            shell = 'printf "%s" > %s' % (''.join('\\x%02x' % b for b in seq), DEV)
            subprocess.run(['adb', 'shell', shell], check=False)
            time.sleep(0.012)
        seq = (ev(3, 0x39, -1) + ev(1, 0x14a, 0) + ev(0, 0, 0))
        shell = 'printf "%s" > %s' % (''.join('\\x%02x' % b for b in seq), DEV)
        subprocess.run(['adb', 'shell', shell], check=False)
        print('swiped', x1, y1, '->', x2, y2)
