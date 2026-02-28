import traceback
try:
    import backend.app
except Exception as e:
    with open("error_trace.txt", "w") as f:
        traceback.print_exc(file=f)
