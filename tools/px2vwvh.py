#!/usr/bin/env python3
# 把设计稿像素（800×254 横屏）换算成 vw/vh，实现不同分辨率词典笔的自适应拉伸。
# 水平属性 -> vw（100vw = 800px），垂直属性 -> vh（100vh = 254px）。
# border-width 保持 px（细线不缩放）。
import re, glob, sys

H = {'width', 'min-width', 'max-width', 'left', 'right', 'margin-left', 'margin-right',
     'padding-left', 'padding-right', 'border-radius', 'padding', 'margin'}
V = {'height', 'min-height', 'max-height', 'top', 'bottom', 'line-height', 'font-size',
     'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'}

DEC = re.compile(r'^(\s*)([a-zA-Z-]+)\s*:\s*([^;{}]+);(.*)$')
PX = re.compile(r'(-?\d+(?:\.\d+)?)px')

def conv_line(line):
    m = DEC.match(line)
    if not m:
        return line
    indent, prop, val, tail = m.groups()
    if prop in H:
        factor, unit = 100.0 / 800, 'vw'
    elif prop in V:
        factor, unit = 100.0 / 254, 'vh'
    else:
        return line
    if not PX.search(val):
        return line
    def r(mm):
        v = float(mm.group(1)) * factor
        v = round(v, 2)
        if v == int(v):
            v = int(v)
        return '%g%s' % (v, unit)
    newval = PX.sub(r, val)
    return indent + prop + ': ' + newval + ';' + tail

total = 0
for path in glob.glob('ui/src/**/*.vue', recursive=True) + glob.glob('ui/src/**/*.less', recursive=True):
    out = []
    changed = 0
    for line in open(path, encoding='utf-8').read().splitlines():
        new = conv_line(line)
        if new != line:
            changed += 1
        out.append(new)
    if changed:
        open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
        print('%-46s %d lines' % (path, changed))
        total += changed
print('converted lines:', total)
