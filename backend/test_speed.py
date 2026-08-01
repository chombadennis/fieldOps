import time
import urllib.request
import json

print("Sending Request 1 (Cold Start / Pre-ping)...")
start1 = time.time()
req1 = urllib.request.Request("http://127.0.0.1:8000/api/projects")
with urllib.request.urlopen(req1) as resp:
    data1 = json.loads(resp.read().decode("utf-8"))
end1 = time.time()
print(f"Request 1 completed in {end1 - start1:.3f} seconds.")

print("Sending Request 2 (Warm Connection)...")
start2 = time.time()
req2 = urllib.request.Request("http://127.0.0.1:8000/api/projects")
with urllib.request.urlopen(req2) as resp:
    data2 = json.loads(resp.read().decode("utf-8"))
end2 = time.time()
print(f"Request 2 completed in {end2 - start2:.3f} seconds.")
