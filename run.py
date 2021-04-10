#!/usr/bin/python3
# -*- coding:utf-8 -*-
import sys
import os
from math import floor

picdir = os.path.join(os.path.dirname(os.path.realpath(__file__)))
sys.path.append("/home/pi/SlowMovie/e-Paper/RaspberryPi_JetsonNano/python/lib")
from PIL import Image,ImageDraw,ImageFont
from waveshare_epd import epd7in5_HD

try:

    epd = epd7in5_HD.EPD()
    epd.init()
    print(epd.width)
    print(epd.height)
    h_image = Image.new('1', (epd.width, epd.height), 255)
    screen_output_file = Image.open(os.path.join(picdir, 'tmp.jpeg'))
    screen_output_file.resize((epd.width, epd.height), Image.BICUBIC)
    x, y = screen_output_file.size
    print(x)
    print(y)
    xs = 0
    ys = 0
    if x<epd.width:
        xs = floor((epd.width-x)/2)
    
    if y<epd.height:
        ys = floor((epd.height-y)/2)
    
    print(xs)
    print(ys)
    h_image.paste(screen_output_file, (xs, ys))
    epd.display(epd.getbuffer(h_image))
    #epd.display(epd.getbuffer(Himage))
 
    ##epd.sleep()
    
except IOError as e:
    print(e)
    
except KeyboardInterrupt:    
    epd7in5_HD.epdconfig.module_exit()
    exit()
