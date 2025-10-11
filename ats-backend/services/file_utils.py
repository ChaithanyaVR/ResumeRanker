import hashlib

def compute_file_hash(file_stream):
    """
    Compute a SHA256 hash of a file stream.
    The file pointer is reset to the beginning after reading.
    """
    hasher = hashlib.sha256()
    for chunk in iter(lambda: file_stream.read(4096), b""):
        hasher.update(chunk)
    file_stream.seek(0)  
    return hasher.hexdigest()

