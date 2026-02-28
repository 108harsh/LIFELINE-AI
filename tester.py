import traceback

try:
    import backend.app
except Exception as e:
    with open("et.txt", "w", encoding="utf-8") as f:
        f.write(traceback.format_exc())
