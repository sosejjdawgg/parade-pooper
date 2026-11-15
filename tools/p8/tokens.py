#!/usr/bin/env python3
"""Approximate PICO-8 token count for the cart's Lua (limit 8192).
Rules: names, keywords, literals and operators count 1; strings count 1;
bracket pairs count 1; commas, dots, colons, semicolons, 'end', 'local'
and comments are free; a minus sign directly before a number is free."""
import re, sys
src = open(sys.argv[1] if len(sys.argv) > 1 else 'pico8/vape_kayak.lua').read()
src = re.sub(r'--\[\[.*?\]\]', '', src, flags=re.S)
src = re.sub(r'--[^\n]*', '', src)
tok = re.compile(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|0x[0-9a-fA-F.]+|\d*\.\d+|\d+|[A-Za-z_]\w*|\.\.\.|\.\.|==|~=|!=|<=|>=|\+=|-=|\*=|/=|%=|[-+*/%^#<>=(){}\[\];:,.]')
n, prev, prev2 = 0, None, None
for t in tok.findall(src):
    if t in (',', '.', ':', ';', 'end', 'local', ')', ']', '}'):
        prev2, prev = prev, t; continue
    # a minus directly on a number literal is part of it, but only when the
    # minus is unary (after an operator, bracket, comma, keyword or start)
    unary = prev2 is None or prev2 in ('=', '(', '[', '{', ',', 'return', 'and', 'or', 'not', '==', '~=', '!=', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '^', '..', 'then', 'do', 'else', '+=', '-=', '*=', '/=')
    if re.match(r'^(\d|0x|\.\d)', t) and prev == '-' and unary:
        n -= 1   # the '-' already counted; '-1' is a single token
    n += 1; prev2, prev = prev, t
print(n, 'tokens (limit 8192)')
