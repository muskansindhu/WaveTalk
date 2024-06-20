from datetime import datetime

def get_current_datetime():
    datetime_string = datetime.now().strftime("%Y-%m-%d||%H:%M:%S")
    return datetime_string