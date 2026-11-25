import paramiko

from ssharg.server import SERVER_VERSION, ArgServer


def test_auth_policy():
    s = ArgServer("hello\n")
    assert s.check_auth_none("Alice") == paramiko.AUTH_SUCCESSFUL
    assert s.username == "Alice"
    assert s.check_auth_password("bob", "") == paramiko.AUTH_SUCCESSFUL
    assert s.check_auth_password("bob", "hunter2") == paramiko.AUTH_SUCCESSFUL
    assert isinstance(s.check_auth_interactive("carol", ""), paramiko.InteractiveQuery)
    assert s.check_auth_interactive_response([]) == paramiko.AUTH_SUCCESSFUL
    key = paramiko.RSAKey.generate(1024)
    assert s.check_auth_publickey("eve", key) == paramiko.AUTH_FAILED
    assert "publickey" not in s.get_allowed_auths("x")


def test_channel_requests():
    s = ArgServer()
    assert s.check_channel_request("session", 1) == paramiko.OPEN_SUCCEEDED
    assert s.check_channel_request("direct-tcpip", 2) != paramiko.OPEN_SUCCEEDED
    assert s.check_channel_pty_request(None, b"xterm-256color", 120, 40, 0, 0, b"")
    assert s.pty and s.width == 120 and s.term_type == "xterm-256color"
    assert s.check_channel_exec_request(None, b"ls -l")
    assert s.command == "ls -l" and s.ready.is_set()


def test_shell_request_sets_ready():
    s = ArgServer()
    assert s.check_channel_shell_request(None)
    assert s.ready.is_set() and s.command is None


def test_banner_and_version():
    assert ArgServer("a\nb\n").get_banner() == ("a\r\nb\r\n", "en-US")
    assert ArgServer("").get_banner() == (None, None)
    assert SERVER_VERSION.startswith("SSH-2.0-OpenSSH_")
