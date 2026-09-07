"""Reproduce the bundled, unmodified pgfplots sources from a verified CTAN archive.

Usage: python3 scripts/vendor-tikz-libraries.py /path/to/pgfplots.tar.xz
Source: https://mirrors.mit.edu/CTAN/systems/texlive/tlnet/archive/pgfplots.tar.xz
TeX Live revision 80105; pgfplots 1.18.3 (2026-08-26).
Normal builds use the checked-in result and need no network or Python.
"""
import gzip
import hashlib
import io
from pathlib import Path
import sys
import tarfile

EXPECTED = "86e6c635020970b292fecaf81d972452c0a75abecd0933db8ec27ee8f7174f9c"
root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]).read_bytes()
if hashlib.sha256(source).hexdigest() != EXPECTED:
    raise SystemExit("Wrong pgfplots source archive; expected TeX Live revision 80105")
files = {}
with tarfile.open(fileobj=io.BytesIO(source), mode="r:xz") as archive:
    for member in archive.getmembers():
        if member.isfile() and member.name.startswith(("tex/", "tlpkg/tlpobj/")):
            files[member.name] = archive.extractfile(member).read()
files["LICENSE"] = (root / "resources/tikz-GPL-3.0.txt").read_bytes()
result = io.BytesIO()
with tarfile.open(fileobj=result, mode="w", format=tarfile.USTAR_FORMAT) as archive:
    for name, data in sorted(files.items()):
        member = tarfile.TarInfo(name)
        member.mode = 0o644
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))
destination = root / "resources/tikz-pgfplots-1.18.3.tar.gz"
# Fix gzip metadata too, so regeneration is byte-identical across platforms.
with destination.open("wb") as out:
    with gzip.GzipFile(fileobj=out, mode="wb", filename="", mtime=0, compresslevel=9) as compressed:
        compressed.write(result.getvalue())
print(destination.name, destination.stat().st_size, hashlib.sha256(destination.read_bytes()).hexdigest())
