import socketserver, os, time
OUT = os.path.join(os.environ.get("HARNESS", "/tmp/sb"), "mail"); os.makedirs(OUT, exist_ok=True)
class H(socketserver.StreamRequestHandler):
    def w(self, s): self.wfile.write((s + "\r\n").encode())
    def handle(self):
        self.w("220 sink ESMTP")
        rcpt = []
        while True:
            line = self.rfile.readline().decode(errors="replace")
            if not line: return
            cmd = line.strip().upper()
            if cmd.startswith(("EHLO", "HELO")): self.w("250-sink"); self.w("250-AUTH PLAIN LOGIN"); self.w("250 OK")
            elif cmd.startswith("AUTH LOGIN"): self.w("334 VXNlcm5hbWU6"); self.rfile.readline(); self.w("334 UGFzc3dvcmQ6"); self.rfile.readline(); self.w("235 OK")
            elif cmd.startswith("AUTH"): self.w("235 OK")
            elif cmd.startswith("RCPT"): rcpt.append(line.split(":", 1)[1].strip().strip("<>")); self.w("250 OK")
            elif cmd == "DATA":
                self.w("354 go"); data = []
                while True:
                    l = self.rfile.readline().decode(errors="replace")
                    if l.strip() == ".": break
                    data.append(l)
                fn = f"{OUT}/{time.time():.6f}_{rcpt[0] if rcpt else 'x'}.eml"
                open(fn, "w").write("".join(data)); rcpt = []; self.w("250 queued")
            elif cmd == "QUIT": self.w("221 bye"); return
            else: self.w("250 OK")
socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(("127.0.0.1", 2500), H).serve_forever()
