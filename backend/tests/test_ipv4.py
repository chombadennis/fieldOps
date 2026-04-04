import urllib.request
import time
import socket

# This tests if Python can natively connect without timing out (like Chrome did)
url = 'https://generativelanguage.googleapis.com/v1beta/models'

print(f"Connecting to {url}...")
try:
    start = time.time()
    # A 10-second timeout
    response = urllib.request.urlopen(url, timeout=10)
    print(f"Success! Reached Google in {time.time() - start:.2f} seconds.")
except urllib.error.HTTPError as e:
    # 403 Forbidden is EXACTLY what Chrome got, which means connection succeeded!
    print(f"SUCCESS: Connected! Got error (expected because no API key): {e}")
except urllib.error.URLError as e:
    print(f"FAILED to reach Google purely through Python. Error: {e}")
    if "timeout" in str(e).lower() or "1015" in str(e):
        print("\nDIAGNOSIS:")
        print("This proves Python's raw underlying network connection to Google is blocked or mangled (e.g., Python is trying an IPv6 route that leads to a black hole, or an antivirus is scanning python.exe tightly). Your browser natively avoids this.")
