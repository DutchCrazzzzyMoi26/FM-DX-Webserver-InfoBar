Info Bar - example news and weather ticker
Author: DutchCrazzzzyMoi26

Files:
- example_news_weather_ticker.py
  Example Python script that creates message.txt with readable lines:
  * weather link for the Netherlands
  * latest 3 items from the NU.nl RSS feed
  * latest 3 items from the NOS RSS feed

  Each item is written on its own line in the TXT file.
  Info Bar still displays it as one horizontal scrolling ticker line.

- example_message.txt
  Simple manual example text for a quick test. The items are on separate lines,
  but Info Bar displays them as one ticker line.

Usage:
1. Place example_news_weather_ticker.py somewhere on the FM-DX Webserver computer, for example:
   D:\Scripts\example_news_weather_ticker.py

2. Open the script with Notepad and check this line:
   OUTPUT_FILE = Path(r"D:\Scripts\message.txt")

3. Run the script:
   python D:\Scripts\example_news_weather_ticker.py

4. In the Info Bar setup page, enter:
   D:\Scripts\message.txt

5. Set the Info Bar check interval to 300 seconds if your file updates every 5 minutes.

Automatic updates:
- Recommended: run the Python script every 5 minutes with Windows Task Scheduler.
- Alternative: set RUN_FOREVER = True in the script. The script will then keep running and write a new TXT file every 300 seconds.

Notes:
- RSS feeds can change or become unavailable.
- The weather link points to a general Weeronline page for the Netherlands.
