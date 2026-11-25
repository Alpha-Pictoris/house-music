"""Allow `python -m ssharg`."""
import sys

from .cli import main

sys.exit(main())
