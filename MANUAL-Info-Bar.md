Info Bar - FM-DX Webserver plugin
Author: DutchCrazzzzyMoi26

What it does
------------
Info Bar shows one fixed horizontal ticker below the FM-DX graph/canvas area.
The ticker scrolls from right to left and can display plain text or safe HTML from a local .txt file.

The plugin checks the TXT file automatically. When new content is found, it is queued and shown after the current ticker text has fully scrolled out of view. The full FM-DX page is not refreshed.

Installation
------------
1. Copy InfoBar.js and the InfoBar folder into your FM-DX Webserver plugins folder.
2. Restart FM-DX Webserver.
3. Enable the plugin if needed.
4. Open /setup in your FM-DX Webserver.
5. Enter the local path to your TXT file, for example:
   C:\FM-DX\message.txt
6. Set the check interval. Allowed range: 30 to 300 seconds.
7. Choose a bar color, for example:
   #00000080
8. Click Save.

TXT file content
----------------
The TXT file may contain plain text:

Welcome to my FM-DX Webserver • Enjoy listening!

It may also contain safe HTML links:

<a href="https://example.com" target="_blank" rel="noopener noreferrer">Open my website</a>

You may write the TXT file over multiple lines for readability. Info Bar will still display it as one horizontal ticker line.

Security
--------
The plugin filters the HTML before it is displayed.
Allowed examples include text, links and simple formatting tags.
Blocked examples include scripts, iframes, forms, onclick attributes and javascript: links.

Local file path
---------------
The TXT file must be located on the same computer that runs FM-DX Webserver.
A browser file picker is not used, because browsers are not allowed to keep reading arbitrary local files in the background.

Example ticker script
---------------------
This package includes example_news_weather_ticker.py.
It can create a message.txt file with:
- a weather link for the Netherlands
- the latest 3 NU.nl RSS items
- the latest 3 NOS RSS items

The script uses only the Python 3 standard library.

Automatic updates with Windows Task Scheduler
---------------------------------------------
Recommended setup:
1. Let Windows Task Scheduler run example_news_weather_ticker.py every 5 minutes.
2. Set Info Bar's check interval to 300 seconds.
3. Info Bar will read the updated TXT file automatically.

Common issues
-------------
ENOENT / file not found:
- Check that the path is exactly correct.
- Make sure the file is really named .txt and not .txt.txt.
- Make sure FM-DX Webserver runs on the same computer.
- Make sure the user account running FM-DX Webserver can read the file.

Windows path on Linux/WSL/Docker:
- A path like D:\Scripts\message.txt only works when FM-DX Webserver itself runs on Windows.

Bar color examples
------------------
#000000ff  black, fully visible
#000000cc  black, mostly visible
#00000080  black, semi-transparent
#00000040  black, very transparent
#00000000  fully transparent
transparent  fully transparent
