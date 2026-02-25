import bt, { app as Mt, dialog as Hr, BrowserWindow as na, ipcMain as Ec, Menu as yc, safeStorage as gr } from "electron";
import mt from "fs";
import wc from "constants";
import vr from "stream";
import ia from "util";
import Ul from "assert";
import Ie from "path";
import jr from "child_process";
import kl from "events";
import Er from "crypto";
import ql from "tty";
import Gr from "os";
import gt from "url";
import $l from "zlib";
import _c from "http";
import { dirname as Rc, resolve as Wr, join as Xe, isAbsolute as Ac, sep as Tc } from "node:path";
import { fileURLToPath as Sc } from "node:url";
import { readFile as Ml, writeFile as Cc } from "node:fs/promises";
import { homedir as bc } from "node:os";
import { platform as Pc } from "node:process";
var Qe = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, At = {}, nn = {}, Pr = {}, Na;
function We() {
  return Na || (Na = 1, Pr.fromCallback = function(t) {
    return Object.defineProperty(function(...d) {
      if (typeof d[d.length - 1] == "function") t.apply(this, d);
      else
        return new Promise((p, c) => {
          d.push((f, u) => f != null ? c(f) : p(u)), t.apply(this, d);
        });
    }, "name", { value: t.name });
  }, Pr.fromPromise = function(t) {
    return Object.defineProperty(function(...d) {
      const p = d[d.length - 1];
      if (typeof p != "function") return t.apply(this, d);
      d.pop(), t.apply(this, d).then((c) => p(null, c), p);
    }, "name", { value: t.name });
  }), Pr;
}
var an, Fa;
function Oc() {
  if (Fa) return an;
  Fa = 1;
  var t = wc, d = process.cwd, p = null, c = process.env.GRACEFUL_FS_PLATFORM || process.platform;
  process.cwd = function() {
    return p || (p = d.call(process)), p;
  };
  try {
    process.cwd();
  } catch {
  }
  if (typeof process.chdir == "function") {
    var f = process.chdir;
    process.chdir = function(a) {
      p = null, f.call(process, a);
    }, Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, f);
  }
  an = u;
  function u(a) {
    t.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) && l(a), a.lutimes || o(a), a.chown = r(a.chown), a.fchown = r(a.fchown), a.lchown = r(a.lchown), a.chmod = s(a.chmod), a.fchmod = s(a.fchmod), a.lchmod = s(a.lchmod), a.chownSync = n(a.chownSync), a.fchownSync = n(a.fchownSync), a.lchownSync = n(a.lchownSync), a.chmodSync = i(a.chmodSync), a.fchmodSync = i(a.fchmodSync), a.lchmodSync = i(a.lchmodSync), a.stat = h(a.stat), a.fstat = h(a.fstat), a.lstat = h(a.lstat), a.statSync = g(a.statSync), a.fstatSync = g(a.fstatSync), a.lstatSync = g(a.lstatSync), a.chmod && !a.lchmod && (a.lchmod = function(m, _, T) {
      T && process.nextTick(T);
    }, a.lchmodSync = function() {
    }), a.chown && !a.lchown && (a.lchown = function(m, _, T, P) {
      P && process.nextTick(P);
    }, a.lchownSync = function() {
    }), c === "win32" && (a.rename = typeof a.rename != "function" ? a.rename : (function(m) {
      function _(T, P, O) {
        var b = Date.now(), I = 0;
        m(T, P, function S(A) {
          if (A && (A.code === "EACCES" || A.code === "EPERM" || A.code === "EBUSY") && Date.now() - b < 6e4) {
            setTimeout(function() {
              a.stat(P, function(v, k) {
                v && v.code === "ENOENT" ? m(T, P, S) : O(A);
              });
            }, I), I < 100 && (I += 10);
            return;
          }
          O && O(A);
        });
      }
      return Object.setPrototypeOf && Object.setPrototypeOf(_, m), _;
    })(a.rename)), a.read = typeof a.read != "function" ? a.read : (function(m) {
      function _(T, P, O, b, I, S) {
        var A;
        if (S && typeof S == "function") {
          var v = 0;
          A = function(k, q, x) {
            if (k && k.code === "EAGAIN" && v < 10)
              return v++, m.call(a, T, P, O, b, I, A);
            S.apply(this, arguments);
          };
        }
        return m.call(a, T, P, O, b, I, A);
      }
      return Object.setPrototypeOf && Object.setPrototypeOf(_, m), _;
    })(a.read), a.readSync = typeof a.readSync != "function" ? a.readSync : /* @__PURE__ */ (function(m) {
      return function(_, T, P, O, b) {
        for (var I = 0; ; )
          try {
            return m.call(a, _, T, P, O, b);
          } catch (S) {
            if (S.code === "EAGAIN" && I < 10) {
              I++;
              continue;
            }
            throw S;
          }
      };
    })(a.readSync);
    function l(m) {
      m.lchmod = function(_, T, P) {
        m.open(
          _,
          t.O_WRONLY | t.O_SYMLINK,
          T,
          function(O, b) {
            if (O) {
              P && P(O);
              return;
            }
            m.fchmod(b, T, function(I) {
              m.close(b, function(S) {
                P && P(I || S);
              });
            });
          }
        );
      }, m.lchmodSync = function(_, T) {
        var P = m.openSync(_, t.O_WRONLY | t.O_SYMLINK, T), O = !0, b;
        try {
          b = m.fchmodSync(P, T), O = !1;
        } finally {
          if (O)
            try {
              m.closeSync(P);
            } catch {
            }
          else
            m.closeSync(P);
        }
        return b;
      };
    }
    function o(m) {
      t.hasOwnProperty("O_SYMLINK") && m.futimes ? (m.lutimes = function(_, T, P, O) {
        m.open(_, t.O_SYMLINK, function(b, I) {
          if (b) {
            O && O(b);
            return;
          }
          m.futimes(I, T, P, function(S) {
            m.close(I, function(A) {
              O && O(S || A);
            });
          });
        });
      }, m.lutimesSync = function(_, T, P) {
        var O = m.openSync(_, t.O_SYMLINK), b, I = !0;
        try {
          b = m.futimesSync(O, T, P), I = !1;
        } finally {
          if (I)
            try {
              m.closeSync(O);
            } catch {
            }
          else
            m.closeSync(O);
        }
        return b;
      }) : m.futimes && (m.lutimes = function(_, T, P, O) {
        O && process.nextTick(O);
      }, m.lutimesSync = function() {
      });
    }
    function s(m) {
      return m && function(_, T, P) {
        return m.call(a, _, T, function(O) {
          y(O) && (O = null), P && P.apply(this, arguments);
        });
      };
    }
    function i(m) {
      return m && function(_, T) {
        try {
          return m.call(a, _, T);
        } catch (P) {
          if (!y(P)) throw P;
        }
      };
    }
    function r(m) {
      return m && function(_, T, P, O) {
        return m.call(a, _, T, P, function(b) {
          y(b) && (b = null), O && O.apply(this, arguments);
        });
      };
    }
    function n(m) {
      return m && function(_, T, P) {
        try {
          return m.call(a, _, T, P);
        } catch (O) {
          if (!y(O)) throw O;
        }
      };
    }
    function h(m) {
      return m && function(_, T, P) {
        typeof T == "function" && (P = T, T = null);
        function O(b, I) {
          I && (I.uid < 0 && (I.uid += 4294967296), I.gid < 0 && (I.gid += 4294967296)), P && P.apply(this, arguments);
        }
        return T ? m.call(a, _, T, O) : m.call(a, _, O);
      };
    }
    function g(m) {
      return m && function(_, T) {
        var P = T ? m.call(a, _, T) : m.call(a, _);
        return P && (P.uid < 0 && (P.uid += 4294967296), P.gid < 0 && (P.gid += 4294967296)), P;
      };
    }
    function y(m) {
      if (!m || m.code === "ENOSYS")
        return !0;
      var _ = !process.getuid || process.getuid() !== 0;
      return !!(_ && (m.code === "EINVAL" || m.code === "EPERM"));
    }
  }
  return an;
}
var on, La;
function Ic() {
  if (La) return on;
  La = 1;
  var t = vr.Stream;
  on = d;
  function d(p) {
    return {
      ReadStream: c,
      WriteStream: f
    };
    function c(u, a) {
      if (!(this instanceof c)) return new c(u, a);
      t.call(this);
      var l = this;
      this.path = u, this.fd = null, this.readable = !0, this.paused = !1, this.flags = "r", this.mode = 438, this.bufferSize = 64 * 1024, a = a || {};
      for (var o = Object.keys(a), s = 0, i = o.length; s < i; s++) {
        var r = o[s];
        this[r] = a[r];
      }
      if (this.encoding && this.setEncoding(this.encoding), this.start !== void 0) {
        if (typeof this.start != "number")
          throw TypeError("start must be a Number");
        if (this.end === void 0)
          this.end = 1 / 0;
        else if (typeof this.end != "number")
          throw TypeError("end must be a Number");
        if (this.start > this.end)
          throw new Error("start must be <= end");
        this.pos = this.start;
      }
      if (this.fd !== null) {
        process.nextTick(function() {
          l._read();
        });
        return;
      }
      p.open(this.path, this.flags, this.mode, function(n, h) {
        if (n) {
          l.emit("error", n), l.readable = !1;
          return;
        }
        l.fd = h, l.emit("open", h), l._read();
      });
    }
    function f(u, a) {
      if (!(this instanceof f)) return new f(u, a);
      t.call(this), this.path = u, this.fd = null, this.writable = !0, this.flags = "w", this.encoding = "binary", this.mode = 438, this.bytesWritten = 0, a = a || {};
      for (var l = Object.keys(a), o = 0, s = l.length; o < s; o++) {
        var i = l[o];
        this[i] = a[i];
      }
      if (this.start !== void 0) {
        if (typeof this.start != "number")
          throw TypeError("start must be a Number");
        if (this.start < 0)
          throw new Error("start must be >= zero");
        this.pos = this.start;
      }
      this.busy = !1, this._queue = [], this.fd === null && (this._open = p.open, this._queue.push([this._open, this.path, this.flags, this.mode, void 0]), this.flush());
    }
  }
  return on;
}
var sn, xa;
function Dc() {
  if (xa) return sn;
  xa = 1, sn = d;
  var t = Object.getPrototypeOf || function(p) {
    return p.__proto__;
  };
  function d(p) {
    if (p === null || typeof p != "object")
      return p;
    if (p instanceof Object)
      var c = { __proto__: t(p) };
    else
      var c = /* @__PURE__ */ Object.create(null);
    return Object.getOwnPropertyNames(p).forEach(function(f) {
      Object.defineProperty(c, f, Object.getOwnPropertyDescriptor(p, f));
    }), c;
  }
  return sn;
}
var Or, Ua;
function je() {
  if (Ua) return Or;
  Ua = 1;
  var t = mt, d = Oc(), p = Ic(), c = Dc(), f = ia, u, a;
  typeof Symbol == "function" && typeof Symbol.for == "function" ? (u = /* @__PURE__ */ Symbol.for("graceful-fs.queue"), a = /* @__PURE__ */ Symbol.for("graceful-fs.previous")) : (u = "___graceful-fs.queue", a = "___graceful-fs.previous");
  function l() {
  }
  function o(m, _) {
    Object.defineProperty(m, u, {
      get: function() {
        return _;
      }
    });
  }
  var s = l;
  if (f.debuglog ? s = f.debuglog("gfs4") : /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && (s = function() {
    var m = f.format.apply(f, arguments);
    m = "GFS4: " + m.split(/\n/).join(`
GFS4: `), console.error(m);
  }), !t[u]) {
    var i = Qe[u] || [];
    o(t, i), t.close = (function(m) {
      function _(T, P) {
        return m.call(t, T, function(O) {
          O || g(), typeof P == "function" && P.apply(this, arguments);
        });
      }
      return Object.defineProperty(_, a, {
        value: m
      }), _;
    })(t.close), t.closeSync = (function(m) {
      function _(T) {
        m.apply(t, arguments), g();
      }
      return Object.defineProperty(_, a, {
        value: m
      }), _;
    })(t.closeSync), /\bgfs4\b/i.test(process.env.NODE_DEBUG || "") && process.on("exit", function() {
      s(t[u]), Ul.equal(t[u].length, 0);
    });
  }
  Qe[u] || o(Qe, t[u]), Or = r(c(t)), process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !t.__patched && (Or = r(t), t.__patched = !0);
  function r(m) {
    d(m), m.gracefulify = r, m.createReadStream = de, m.createWriteStream = ie;
    var _ = m.readFile;
    m.readFile = T;
    function T(Q, ge, w) {
      return typeof ge == "function" && (w = ge, ge = null), E(Q, ge, w);
      function E(H, F, ce, he) {
        return _(H, F, function(pe) {
          pe && (pe.code === "EMFILE" || pe.code === "ENFILE") ? n([E, [H, F, ce], pe, he || Date.now(), Date.now()]) : typeof ce == "function" && ce.apply(this, arguments);
        });
      }
    }
    var P = m.writeFile;
    m.writeFile = O;
    function O(Q, ge, w, E) {
      return typeof w == "function" && (E = w, w = null), H(Q, ge, w, E);
      function H(F, ce, he, pe, _e) {
        return P(F, ce, he, function(Ee) {
          Ee && (Ee.code === "EMFILE" || Ee.code === "ENFILE") ? n([H, [F, ce, he, pe], Ee, _e || Date.now(), Date.now()]) : typeof pe == "function" && pe.apply(this, arguments);
        });
      }
    }
    var b = m.appendFile;
    b && (m.appendFile = I);
    function I(Q, ge, w, E) {
      return typeof w == "function" && (E = w, w = null), H(Q, ge, w, E);
      function H(F, ce, he, pe, _e) {
        return b(F, ce, he, function(Ee) {
          Ee && (Ee.code === "EMFILE" || Ee.code === "ENFILE") ? n([H, [F, ce, he, pe], Ee, _e || Date.now(), Date.now()]) : typeof pe == "function" && pe.apply(this, arguments);
        });
      }
    }
    var S = m.copyFile;
    S && (m.copyFile = A);
    function A(Q, ge, w, E) {
      return typeof w == "function" && (E = w, w = 0), H(Q, ge, w, E);
      function H(F, ce, he, pe, _e) {
        return S(F, ce, he, function(Ee) {
          Ee && (Ee.code === "EMFILE" || Ee.code === "ENFILE") ? n([H, [F, ce, he, pe], Ee, _e || Date.now(), Date.now()]) : typeof pe == "function" && pe.apply(this, arguments);
        });
      }
    }
    var v = m.readdir;
    m.readdir = q;
    var k = /^v[0-5]\./;
    function q(Q, ge, w) {
      typeof ge == "function" && (w = ge, ge = null);
      var E = k.test(process.version) ? function(ce, he, pe, _e) {
        return v(ce, H(
          ce,
          he,
          pe,
          _e
        ));
      } : function(ce, he, pe, _e) {
        return v(ce, he, H(
          ce,
          he,
          pe,
          _e
        ));
      };
      return E(Q, ge, w);
      function H(F, ce, he, pe) {
        return function(_e, Ee) {
          _e && (_e.code === "EMFILE" || _e.code === "ENFILE") ? n([
            E,
            [F, ce, he],
            _e,
            pe || Date.now(),
            Date.now()
          ]) : (Ee && Ee.sort && Ee.sort(), typeof he == "function" && he.call(this, _e, Ee));
        };
      }
    }
    if (process.version.substr(0, 4) === "v0.8") {
      var x = p(m);
      D = x.ReadStream, V = x.WriteStream;
    }
    var $ = m.ReadStream;
    $ && (D.prototype = Object.create($.prototype), D.prototype.open = G);
    var L = m.WriteStream;
    L && (V.prototype = Object.create(L.prototype), V.prototype.open = te), Object.defineProperty(m, "ReadStream", {
      get: function() {
        return D;
      },
      set: function(Q) {
        D = Q;
      },
      enumerable: !0,
      configurable: !0
    }), Object.defineProperty(m, "WriteStream", {
      get: function() {
        return V;
      },
      set: function(Q) {
        V = Q;
      },
      enumerable: !0,
      configurable: !0
    });
    var N = D;
    Object.defineProperty(m, "FileReadStream", {
      get: function() {
        return N;
      },
      set: function(Q) {
        N = Q;
      },
      enumerable: !0,
      configurable: !0
    });
    var j = V;
    Object.defineProperty(m, "FileWriteStream", {
      get: function() {
        return j;
      },
      set: function(Q) {
        j = Q;
      },
      enumerable: !0,
      configurable: !0
    });
    function D(Q, ge) {
      return this instanceof D ? ($.apply(this, arguments), this) : D.apply(Object.create(D.prototype), arguments);
    }
    function G() {
      var Q = this;
      ve(Q.path, Q.flags, Q.mode, function(ge, w) {
        ge ? (Q.autoClose && Q.destroy(), Q.emit("error", ge)) : (Q.fd = w, Q.emit("open", w), Q.read());
      });
    }
    function V(Q, ge) {
      return this instanceof V ? (L.apply(this, arguments), this) : V.apply(Object.create(V.prototype), arguments);
    }
    function te() {
      var Q = this;
      ve(Q.path, Q.flags, Q.mode, function(ge, w) {
        ge ? (Q.destroy(), Q.emit("error", ge)) : (Q.fd = w, Q.emit("open", w));
      });
    }
    function de(Q, ge) {
      return new m.ReadStream(Q, ge);
    }
    function ie(Q, ge) {
      return new m.WriteStream(Q, ge);
    }
    var we = m.open;
    m.open = ve;
    function ve(Q, ge, w, E) {
      return typeof w == "function" && (E = w, w = null), H(Q, ge, w, E);
      function H(F, ce, he, pe, _e) {
        return we(F, ce, he, function(Ee, He) {
          Ee && (Ee.code === "EMFILE" || Ee.code === "ENFILE") ? n([H, [F, ce, he, pe], Ee, _e || Date.now(), Date.now()]) : typeof pe == "function" && pe.apply(this, arguments);
        });
      }
    }
    return m;
  }
  function n(m) {
    s("ENQUEUE", m[0].name, m[1]), t[u].push(m), y();
  }
  var h;
  function g() {
    for (var m = Date.now(), _ = 0; _ < t[u].length; ++_)
      t[u][_].length > 2 && (t[u][_][3] = m, t[u][_][4] = m);
    y();
  }
  function y() {
    if (clearTimeout(h), h = void 0, t[u].length !== 0) {
      var m = t[u].shift(), _ = m[0], T = m[1], P = m[2], O = m[3], b = m[4];
      if (O === void 0)
        s("RETRY", _.name, T), _.apply(null, T);
      else if (Date.now() - O >= 6e4) {
        s("TIMEOUT", _.name, T);
        var I = T.pop();
        typeof I == "function" && I.call(null, P);
      } else {
        var S = Date.now() - b, A = Math.max(b - O, 1), v = Math.min(A * 1.2, 100);
        S >= v ? (s("RETRY", _.name, T), _.apply(null, T.concat([O]))) : t[u].push(m);
      }
      h === void 0 && (h = setTimeout(y, 0));
    }
  }
  return Or;
}
var ka;
function Bt() {
  return ka || (ka = 1, (function(t) {
    const d = We().fromCallback, p = je(), c = [
      "access",
      "appendFile",
      "chmod",
      "chown",
      "close",
      "copyFile",
      "fchmod",
      "fchown",
      "fdatasync",
      "fstat",
      "fsync",
      "ftruncate",
      "futimes",
      "lchmod",
      "lchown",
      "link",
      "lstat",
      "mkdir",
      "mkdtemp",
      "open",
      "opendir",
      "readdir",
      "readFile",
      "readlink",
      "realpath",
      "rename",
      "rm",
      "rmdir",
      "stat",
      "symlink",
      "truncate",
      "unlink",
      "utimes",
      "writeFile"
    ].filter((f) => typeof p[f] == "function");
    Object.assign(t, p), c.forEach((f) => {
      t[f] = d(p[f]);
    }), t.exists = function(f, u) {
      return typeof u == "function" ? p.exists(f, u) : new Promise((a) => p.exists(f, a));
    }, t.read = function(f, u, a, l, o, s) {
      return typeof s == "function" ? p.read(f, u, a, l, o, s) : new Promise((i, r) => {
        p.read(f, u, a, l, o, (n, h, g) => {
          if (n) return r(n);
          i({ bytesRead: h, buffer: g });
        });
      });
    }, t.write = function(f, u, ...a) {
      return typeof a[a.length - 1] == "function" ? p.write(f, u, ...a) : new Promise((l, o) => {
        p.write(f, u, ...a, (s, i, r) => {
          if (s) return o(s);
          l({ bytesWritten: i, buffer: r });
        });
      });
    }, typeof p.writev == "function" && (t.writev = function(f, u, ...a) {
      return typeof a[a.length - 1] == "function" ? p.writev(f, u, ...a) : new Promise((l, o) => {
        p.writev(f, u, ...a, (s, i, r) => {
          if (s) return o(s);
          l({ bytesWritten: i, buffers: r });
        });
      });
    }), typeof p.realpath.native == "function" ? t.realpath.native = d(p.realpath.native) : process.emitWarning(
      "fs.realpath.native is not a function. Is fs being monkey-patched?",
      "Warning",
      "fs-extra-WARN0003"
    );
  })(nn)), nn;
}
var Ir = {}, ln = {}, qa;
function Nc() {
  if (qa) return ln;
  qa = 1;
  const t = Ie;
  return ln.checkPath = function(p) {
    if (process.platform === "win32" && /[<>:"|?*]/.test(p.replace(t.parse(p).root, ""))) {
      const f = new Error(`Path contains invalid characters: ${p}`);
      throw f.code = "EINVAL", f;
    }
  }, ln;
}
var $a;
function Fc() {
  if ($a) return Ir;
  $a = 1;
  const t = /* @__PURE__ */ Bt(), { checkPath: d } = /* @__PURE__ */ Nc(), p = (c) => {
    const f = { mode: 511 };
    return typeof c == "number" ? c : { ...f, ...c }.mode;
  };
  return Ir.makeDir = async (c, f) => (d(c), t.mkdir(c, {
    mode: p(f),
    recursive: !0
  })), Ir.makeDirSync = (c, f) => (d(c), t.mkdirSync(c, {
    mode: p(f),
    recursive: !0
  })), Ir;
}
var un, Ma;
function rt() {
  if (Ma) return un;
  Ma = 1;
  const t = We().fromPromise, { makeDir: d, makeDirSync: p } = /* @__PURE__ */ Fc(), c = t(d);
  return un = {
    mkdirs: c,
    mkdirsSync: p,
    // alias
    mkdirp: c,
    mkdirpSync: p,
    ensureDir: c,
    ensureDirSync: p
  }, un;
}
var cn, Ba;
function Pt() {
  if (Ba) return cn;
  Ba = 1;
  const t = We().fromPromise, d = /* @__PURE__ */ Bt();
  function p(c) {
    return d.access(c).then(() => !0).catch(() => !1);
  }
  return cn = {
    pathExists: t(p),
    pathExistsSync: d.existsSync
  }, cn;
}
var fn, Ha;
function Bl() {
  if (Ha) return fn;
  Ha = 1;
  const t = je();
  function d(c, f, u, a) {
    t.open(c, "r+", (l, o) => {
      if (l) return a(l);
      t.futimes(o, f, u, (s) => {
        t.close(o, (i) => {
          a && a(s || i);
        });
      });
    });
  }
  function p(c, f, u) {
    const a = t.openSync(c, "r+");
    return t.futimesSync(a, f, u), t.closeSync(a);
  }
  return fn = {
    utimesMillis: d,
    utimesMillisSync: p
  }, fn;
}
var dn, ja;
function Ht() {
  if (ja) return dn;
  ja = 1;
  const t = /* @__PURE__ */ Bt(), d = Ie, p = ia;
  function c(n, h, g) {
    const y = g.dereference ? (m) => t.stat(m, { bigint: !0 }) : (m) => t.lstat(m, { bigint: !0 });
    return Promise.all([
      y(n),
      y(h).catch((m) => {
        if (m.code === "ENOENT") return null;
        throw m;
      })
    ]).then(([m, _]) => ({ srcStat: m, destStat: _ }));
  }
  function f(n, h, g) {
    let y;
    const m = g.dereference ? (T) => t.statSync(T, { bigint: !0 }) : (T) => t.lstatSync(T, { bigint: !0 }), _ = m(n);
    try {
      y = m(h);
    } catch (T) {
      if (T.code === "ENOENT") return { srcStat: _, destStat: null };
      throw T;
    }
    return { srcStat: _, destStat: y };
  }
  function u(n, h, g, y, m) {
    p.callbackify(c)(n, h, y, (_, T) => {
      if (_) return m(_);
      const { srcStat: P, destStat: O } = T;
      if (O) {
        if (s(P, O)) {
          const b = d.basename(n), I = d.basename(h);
          return g === "move" && b !== I && b.toLowerCase() === I.toLowerCase() ? m(null, { srcStat: P, destStat: O, isChangingCase: !0 }) : m(new Error("Source and destination must not be the same."));
        }
        if (P.isDirectory() && !O.isDirectory())
          return m(new Error(`Cannot overwrite non-directory '${h}' with directory '${n}'.`));
        if (!P.isDirectory() && O.isDirectory())
          return m(new Error(`Cannot overwrite directory '${h}' with non-directory '${n}'.`));
      }
      return P.isDirectory() && i(n, h) ? m(new Error(r(n, h, g))) : m(null, { srcStat: P, destStat: O });
    });
  }
  function a(n, h, g, y) {
    const { srcStat: m, destStat: _ } = f(n, h, y);
    if (_) {
      if (s(m, _)) {
        const T = d.basename(n), P = d.basename(h);
        if (g === "move" && T !== P && T.toLowerCase() === P.toLowerCase())
          return { srcStat: m, destStat: _, isChangingCase: !0 };
        throw new Error("Source and destination must not be the same.");
      }
      if (m.isDirectory() && !_.isDirectory())
        throw new Error(`Cannot overwrite non-directory '${h}' with directory '${n}'.`);
      if (!m.isDirectory() && _.isDirectory())
        throw new Error(`Cannot overwrite directory '${h}' with non-directory '${n}'.`);
    }
    if (m.isDirectory() && i(n, h))
      throw new Error(r(n, h, g));
    return { srcStat: m, destStat: _ };
  }
  function l(n, h, g, y, m) {
    const _ = d.resolve(d.dirname(n)), T = d.resolve(d.dirname(g));
    if (T === _ || T === d.parse(T).root) return m();
    t.stat(T, { bigint: !0 }, (P, O) => P ? P.code === "ENOENT" ? m() : m(P) : s(h, O) ? m(new Error(r(n, g, y))) : l(n, h, T, y, m));
  }
  function o(n, h, g, y) {
    const m = d.resolve(d.dirname(n)), _ = d.resolve(d.dirname(g));
    if (_ === m || _ === d.parse(_).root) return;
    let T;
    try {
      T = t.statSync(_, { bigint: !0 });
    } catch (P) {
      if (P.code === "ENOENT") return;
      throw P;
    }
    if (s(h, T))
      throw new Error(r(n, g, y));
    return o(n, h, _, y);
  }
  function s(n, h) {
    return h.ino && h.dev && h.ino === n.ino && h.dev === n.dev;
  }
  function i(n, h) {
    const g = d.resolve(n).split(d.sep).filter((m) => m), y = d.resolve(h).split(d.sep).filter((m) => m);
    return g.reduce((m, _, T) => m && y[T] === _, !0);
  }
  function r(n, h, g) {
    return `Cannot ${g} '${n}' to a subdirectory of itself, '${h}'.`;
  }
  return dn = {
    checkPaths: u,
    checkPathsSync: a,
    checkParentPaths: l,
    checkParentPathsSync: o,
    isSrcSubdir: i,
    areIdentical: s
  }, dn;
}
var hn, Ga;
function Lc() {
  if (Ga) return hn;
  Ga = 1;
  const t = je(), d = Ie, p = rt().mkdirs, c = Pt().pathExists, f = Bl().utimesMillis, u = /* @__PURE__ */ Ht();
  function a(q, x, $, L) {
    typeof $ == "function" && !L ? (L = $, $ = {}) : typeof $ == "function" && ($ = { filter: $ }), L = L || function() {
    }, $ = $ || {}, $.clobber = "clobber" in $ ? !!$.clobber : !0, $.overwrite = "overwrite" in $ ? !!$.overwrite : $.clobber, $.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
      `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
      "Warning",
      "fs-extra-WARN0001"
    ), u.checkPaths(q, x, "copy", $, (N, j) => {
      if (N) return L(N);
      const { srcStat: D, destStat: G } = j;
      u.checkParentPaths(q, D, x, "copy", (V) => V ? L(V) : $.filter ? o(l, G, q, x, $, L) : l(G, q, x, $, L));
    });
  }
  function l(q, x, $, L, N) {
    const j = d.dirname($);
    c(j, (D, G) => {
      if (D) return N(D);
      if (G) return i(q, x, $, L, N);
      p(j, (V) => V ? N(V) : i(q, x, $, L, N));
    });
  }
  function o(q, x, $, L, N, j) {
    Promise.resolve(N.filter($, L)).then((D) => D ? q(x, $, L, N, j) : j(), (D) => j(D));
  }
  function s(q, x, $, L, N) {
    return L.filter ? o(i, q, x, $, L, N) : i(q, x, $, L, N);
  }
  function i(q, x, $, L, N) {
    (L.dereference ? t.stat : t.lstat)(x, (D, G) => D ? N(D) : G.isDirectory() ? O(G, q, x, $, L, N) : G.isFile() || G.isCharacterDevice() || G.isBlockDevice() ? r(G, q, x, $, L, N) : G.isSymbolicLink() ? v(q, x, $, L, N) : G.isSocket() ? N(new Error(`Cannot copy a socket file: ${x}`)) : G.isFIFO() ? N(new Error(`Cannot copy a FIFO pipe: ${x}`)) : N(new Error(`Unknown file: ${x}`)));
  }
  function r(q, x, $, L, N, j) {
    return x ? n(q, $, L, N, j) : h(q, $, L, N, j);
  }
  function n(q, x, $, L, N) {
    if (L.overwrite)
      t.unlink($, (j) => j ? N(j) : h(q, x, $, L, N));
    else return L.errorOnExist ? N(new Error(`'${$}' already exists`)) : N();
  }
  function h(q, x, $, L, N) {
    t.copyFile(x, $, (j) => j ? N(j) : L.preserveTimestamps ? g(q.mode, x, $, N) : T($, q.mode, N));
  }
  function g(q, x, $, L) {
    return y(q) ? m($, q, (N) => N ? L(N) : _(q, x, $, L)) : _(q, x, $, L);
  }
  function y(q) {
    return (q & 128) === 0;
  }
  function m(q, x, $) {
    return T(q, x | 128, $);
  }
  function _(q, x, $, L) {
    P(x, $, (N) => N ? L(N) : T($, q, L));
  }
  function T(q, x, $) {
    return t.chmod(q, x, $);
  }
  function P(q, x, $) {
    t.stat(q, (L, N) => L ? $(L) : f(x, N.atime, N.mtime, $));
  }
  function O(q, x, $, L, N, j) {
    return x ? I($, L, N, j) : b(q.mode, $, L, N, j);
  }
  function b(q, x, $, L, N) {
    t.mkdir($, (j) => {
      if (j) return N(j);
      I(x, $, L, (D) => D ? N(D) : T($, q, N));
    });
  }
  function I(q, x, $, L) {
    t.readdir(q, (N, j) => N ? L(N) : S(j, q, x, $, L));
  }
  function S(q, x, $, L, N) {
    const j = q.pop();
    return j ? A(q, j, x, $, L, N) : N();
  }
  function A(q, x, $, L, N, j) {
    const D = d.join($, x), G = d.join(L, x);
    u.checkPaths(D, G, "copy", N, (V, te) => {
      if (V) return j(V);
      const { destStat: de } = te;
      s(de, D, G, N, (ie) => ie ? j(ie) : S(q, $, L, N, j));
    });
  }
  function v(q, x, $, L, N) {
    t.readlink(x, (j, D) => {
      if (j) return N(j);
      if (L.dereference && (D = d.resolve(process.cwd(), D)), q)
        t.readlink($, (G, V) => G ? G.code === "EINVAL" || G.code === "UNKNOWN" ? t.symlink(D, $, N) : N(G) : (L.dereference && (V = d.resolve(process.cwd(), V)), u.isSrcSubdir(D, V) ? N(new Error(`Cannot copy '${D}' to a subdirectory of itself, '${V}'.`)) : q.isDirectory() && u.isSrcSubdir(V, D) ? N(new Error(`Cannot overwrite '${V}' with '${D}'.`)) : k(D, $, N)));
      else
        return t.symlink(D, $, N);
    });
  }
  function k(q, x, $) {
    t.unlink(x, (L) => L ? $(L) : t.symlink(q, x, $));
  }
  return hn = a, hn;
}
var pn, Wa;
function xc() {
  if (Wa) return pn;
  Wa = 1;
  const t = je(), d = Ie, p = rt().mkdirsSync, c = Bl().utimesMillisSync, f = /* @__PURE__ */ Ht();
  function u(S, A, v) {
    typeof v == "function" && (v = { filter: v }), v = v || {}, v.clobber = "clobber" in v ? !!v.clobber : !0, v.overwrite = "overwrite" in v ? !!v.overwrite : v.clobber, v.preserveTimestamps && process.arch === "ia32" && process.emitWarning(
      `Using the preserveTimestamps option in 32-bit node is not recommended;

	see https://github.com/jprichardson/node-fs-extra/issues/269`,
      "Warning",
      "fs-extra-WARN0002"
    );
    const { srcStat: k, destStat: q } = f.checkPathsSync(S, A, "copy", v);
    return f.checkParentPathsSync(S, k, A, "copy"), a(q, S, A, v);
  }
  function a(S, A, v, k) {
    if (k.filter && !k.filter(A, v)) return;
    const q = d.dirname(v);
    return t.existsSync(q) || p(q), o(S, A, v, k);
  }
  function l(S, A, v, k) {
    if (!(k.filter && !k.filter(A, v)))
      return o(S, A, v, k);
  }
  function o(S, A, v, k) {
    const x = (k.dereference ? t.statSync : t.lstatSync)(A);
    if (x.isDirectory()) return _(x, S, A, v, k);
    if (x.isFile() || x.isCharacterDevice() || x.isBlockDevice()) return s(x, S, A, v, k);
    if (x.isSymbolicLink()) return b(S, A, v, k);
    throw x.isSocket() ? new Error(`Cannot copy a socket file: ${A}`) : x.isFIFO() ? new Error(`Cannot copy a FIFO pipe: ${A}`) : new Error(`Unknown file: ${A}`);
  }
  function s(S, A, v, k, q) {
    return A ? i(S, v, k, q) : r(S, v, k, q);
  }
  function i(S, A, v, k) {
    if (k.overwrite)
      return t.unlinkSync(v), r(S, A, v, k);
    if (k.errorOnExist)
      throw new Error(`'${v}' already exists`);
  }
  function r(S, A, v, k) {
    return t.copyFileSync(A, v), k.preserveTimestamps && n(S.mode, A, v), y(v, S.mode);
  }
  function n(S, A, v) {
    return h(S) && g(v, S), m(A, v);
  }
  function h(S) {
    return (S & 128) === 0;
  }
  function g(S, A) {
    return y(S, A | 128);
  }
  function y(S, A) {
    return t.chmodSync(S, A);
  }
  function m(S, A) {
    const v = t.statSync(S);
    return c(A, v.atime, v.mtime);
  }
  function _(S, A, v, k, q) {
    return A ? P(v, k, q) : T(S.mode, v, k, q);
  }
  function T(S, A, v, k) {
    return t.mkdirSync(v), P(A, v, k), y(v, S);
  }
  function P(S, A, v) {
    t.readdirSync(S).forEach((k) => O(k, S, A, v));
  }
  function O(S, A, v, k) {
    const q = d.join(A, S), x = d.join(v, S), { destStat: $ } = f.checkPathsSync(q, x, "copy", k);
    return l($, q, x, k);
  }
  function b(S, A, v, k) {
    let q = t.readlinkSync(A);
    if (k.dereference && (q = d.resolve(process.cwd(), q)), S) {
      let x;
      try {
        x = t.readlinkSync(v);
      } catch ($) {
        if ($.code === "EINVAL" || $.code === "UNKNOWN") return t.symlinkSync(q, v);
        throw $;
      }
      if (k.dereference && (x = d.resolve(process.cwd(), x)), f.isSrcSubdir(q, x))
        throw new Error(`Cannot copy '${q}' to a subdirectory of itself, '${x}'.`);
      if (t.statSync(v).isDirectory() && f.isSrcSubdir(x, q))
        throw new Error(`Cannot overwrite '${x}' with '${q}'.`);
      return I(q, v);
    } else
      return t.symlinkSync(q, v);
  }
  function I(S, A) {
    return t.unlinkSync(A), t.symlinkSync(S, A);
  }
  return pn = u, pn;
}
var mn, Va;
function aa() {
  if (Va) return mn;
  Va = 1;
  const t = We().fromCallback;
  return mn = {
    copy: t(/* @__PURE__ */ Lc()),
    copySync: /* @__PURE__ */ xc()
  }, mn;
}
var gn, Ya;
function Uc() {
  if (Ya) return gn;
  Ya = 1;
  const t = je(), d = Ie, p = Ul, c = process.platform === "win32";
  function f(g) {
    [
      "unlink",
      "chmod",
      "stat",
      "lstat",
      "rmdir",
      "readdir"
    ].forEach((m) => {
      g[m] = g[m] || t[m], m = m + "Sync", g[m] = g[m] || t[m];
    }), g.maxBusyTries = g.maxBusyTries || 3;
  }
  function u(g, y, m) {
    let _ = 0;
    typeof y == "function" && (m = y, y = {}), p(g, "rimraf: missing path"), p.strictEqual(typeof g, "string", "rimraf: path should be a string"), p.strictEqual(typeof m, "function", "rimraf: callback function required"), p(y, "rimraf: invalid options argument provided"), p.strictEqual(typeof y, "object", "rimraf: options should be object"), f(y), a(g, y, function T(P) {
      if (P) {
        if ((P.code === "EBUSY" || P.code === "ENOTEMPTY" || P.code === "EPERM") && _ < y.maxBusyTries) {
          _++;
          const O = _ * 100;
          return setTimeout(() => a(g, y, T), O);
        }
        P.code === "ENOENT" && (P = null);
      }
      m(P);
    });
  }
  function a(g, y, m) {
    p(g), p(y), p(typeof m == "function"), y.lstat(g, (_, T) => {
      if (_ && _.code === "ENOENT")
        return m(null);
      if (_ && _.code === "EPERM" && c)
        return l(g, y, _, m);
      if (T && T.isDirectory())
        return s(g, y, _, m);
      y.unlink(g, (P) => {
        if (P) {
          if (P.code === "ENOENT")
            return m(null);
          if (P.code === "EPERM")
            return c ? l(g, y, P, m) : s(g, y, P, m);
          if (P.code === "EISDIR")
            return s(g, y, P, m);
        }
        return m(P);
      });
    });
  }
  function l(g, y, m, _) {
    p(g), p(y), p(typeof _ == "function"), y.chmod(g, 438, (T) => {
      T ? _(T.code === "ENOENT" ? null : m) : y.stat(g, (P, O) => {
        P ? _(P.code === "ENOENT" ? null : m) : O.isDirectory() ? s(g, y, m, _) : y.unlink(g, _);
      });
    });
  }
  function o(g, y, m) {
    let _;
    p(g), p(y);
    try {
      y.chmodSync(g, 438);
    } catch (T) {
      if (T.code === "ENOENT")
        return;
      throw m;
    }
    try {
      _ = y.statSync(g);
    } catch (T) {
      if (T.code === "ENOENT")
        return;
      throw m;
    }
    _.isDirectory() ? n(g, y, m) : y.unlinkSync(g);
  }
  function s(g, y, m, _) {
    p(g), p(y), p(typeof _ == "function"), y.rmdir(g, (T) => {
      T && (T.code === "ENOTEMPTY" || T.code === "EEXIST" || T.code === "EPERM") ? i(g, y, _) : T && T.code === "ENOTDIR" ? _(m) : _(T);
    });
  }
  function i(g, y, m) {
    p(g), p(y), p(typeof m == "function"), y.readdir(g, (_, T) => {
      if (_) return m(_);
      let P = T.length, O;
      if (P === 0) return y.rmdir(g, m);
      T.forEach((b) => {
        u(d.join(g, b), y, (I) => {
          if (!O) {
            if (I) return m(O = I);
            --P === 0 && y.rmdir(g, m);
          }
        });
      });
    });
  }
  function r(g, y) {
    let m;
    y = y || {}, f(y), p(g, "rimraf: missing path"), p.strictEqual(typeof g, "string", "rimraf: path should be a string"), p(y, "rimraf: missing options"), p.strictEqual(typeof y, "object", "rimraf: options should be object");
    try {
      m = y.lstatSync(g);
    } catch (_) {
      if (_.code === "ENOENT")
        return;
      _.code === "EPERM" && c && o(g, y, _);
    }
    try {
      m && m.isDirectory() ? n(g, y, null) : y.unlinkSync(g);
    } catch (_) {
      if (_.code === "ENOENT")
        return;
      if (_.code === "EPERM")
        return c ? o(g, y, _) : n(g, y, _);
      if (_.code !== "EISDIR")
        throw _;
      n(g, y, _);
    }
  }
  function n(g, y, m) {
    p(g), p(y);
    try {
      y.rmdirSync(g);
    } catch (_) {
      if (_.code === "ENOTDIR")
        throw m;
      if (_.code === "ENOTEMPTY" || _.code === "EEXIST" || _.code === "EPERM")
        h(g, y);
      else if (_.code !== "ENOENT")
        throw _;
    }
  }
  function h(g, y) {
    if (p(g), p(y), y.readdirSync(g).forEach((m) => r(d.join(g, m), y)), c) {
      const m = Date.now();
      do
        try {
          return y.rmdirSync(g, y);
        } catch {
        }
      while (Date.now() - m < 500);
    } else
      return y.rmdirSync(g, y);
  }
  return gn = u, u.sync = r, gn;
}
var vn, za;
function Vr() {
  if (za) return vn;
  za = 1;
  const t = je(), d = We().fromCallback, p = /* @__PURE__ */ Uc();
  function c(u, a) {
    if (t.rm) return t.rm(u, { recursive: !0, force: !0 }, a);
    p(u, a);
  }
  function f(u) {
    if (t.rmSync) return t.rmSync(u, { recursive: !0, force: !0 });
    p.sync(u);
  }
  return vn = {
    remove: d(c),
    removeSync: f
  }, vn;
}
var En, Xa;
function kc() {
  if (Xa) return En;
  Xa = 1;
  const t = We().fromPromise, d = /* @__PURE__ */ Bt(), p = Ie, c = /* @__PURE__ */ rt(), f = /* @__PURE__ */ Vr(), u = t(async function(o) {
    let s;
    try {
      s = await d.readdir(o);
    } catch {
      return c.mkdirs(o);
    }
    return Promise.all(s.map((i) => f.remove(p.join(o, i))));
  });
  function a(l) {
    let o;
    try {
      o = d.readdirSync(l);
    } catch {
      return c.mkdirsSync(l);
    }
    o.forEach((s) => {
      s = p.join(l, s), f.removeSync(s);
    });
  }
  return En = {
    emptyDirSync: a,
    emptydirSync: a,
    emptyDir: u,
    emptydir: u
  }, En;
}
var yn, Ka;
function qc() {
  if (Ka) return yn;
  Ka = 1;
  const t = We().fromCallback, d = Ie, p = je(), c = /* @__PURE__ */ rt();
  function f(a, l) {
    function o() {
      p.writeFile(a, "", (s) => {
        if (s) return l(s);
        l();
      });
    }
    p.stat(a, (s, i) => {
      if (!s && i.isFile()) return l();
      const r = d.dirname(a);
      p.stat(r, (n, h) => {
        if (n)
          return n.code === "ENOENT" ? c.mkdirs(r, (g) => {
            if (g) return l(g);
            o();
          }) : l(n);
        h.isDirectory() ? o() : p.readdir(r, (g) => {
          if (g) return l(g);
        });
      });
    });
  }
  function u(a) {
    let l;
    try {
      l = p.statSync(a);
    } catch {
    }
    if (l && l.isFile()) return;
    const o = d.dirname(a);
    try {
      p.statSync(o).isDirectory() || p.readdirSync(o);
    } catch (s) {
      if (s && s.code === "ENOENT") c.mkdirsSync(o);
      else throw s;
    }
    p.writeFileSync(a, "");
  }
  return yn = {
    createFile: t(f),
    createFileSync: u
  }, yn;
}
var wn, Ja;
function $c() {
  if (Ja) return wn;
  Ja = 1;
  const t = We().fromCallback, d = Ie, p = je(), c = /* @__PURE__ */ rt(), f = Pt().pathExists, { areIdentical: u } = /* @__PURE__ */ Ht();
  function a(o, s, i) {
    function r(n, h) {
      p.link(n, h, (g) => {
        if (g) return i(g);
        i(null);
      });
    }
    p.lstat(s, (n, h) => {
      p.lstat(o, (g, y) => {
        if (g)
          return g.message = g.message.replace("lstat", "ensureLink"), i(g);
        if (h && u(y, h)) return i(null);
        const m = d.dirname(s);
        f(m, (_, T) => {
          if (_) return i(_);
          if (T) return r(o, s);
          c.mkdirs(m, (P) => {
            if (P) return i(P);
            r(o, s);
          });
        });
      });
    });
  }
  function l(o, s) {
    let i;
    try {
      i = p.lstatSync(s);
    } catch {
    }
    try {
      const h = p.lstatSync(o);
      if (i && u(h, i)) return;
    } catch (h) {
      throw h.message = h.message.replace("lstat", "ensureLink"), h;
    }
    const r = d.dirname(s);
    return p.existsSync(r) || c.mkdirsSync(r), p.linkSync(o, s);
  }
  return wn = {
    createLink: t(a),
    createLinkSync: l
  }, wn;
}
var _n, Qa;
function Mc() {
  if (Qa) return _n;
  Qa = 1;
  const t = Ie, d = je(), p = Pt().pathExists;
  function c(u, a, l) {
    if (t.isAbsolute(u))
      return d.lstat(u, (o) => o ? (o.message = o.message.replace("lstat", "ensureSymlink"), l(o)) : l(null, {
        toCwd: u,
        toDst: u
      }));
    {
      const o = t.dirname(a), s = t.join(o, u);
      return p(s, (i, r) => i ? l(i) : r ? l(null, {
        toCwd: s,
        toDst: u
      }) : d.lstat(u, (n) => n ? (n.message = n.message.replace("lstat", "ensureSymlink"), l(n)) : l(null, {
        toCwd: u,
        toDst: t.relative(o, u)
      })));
    }
  }
  function f(u, a) {
    let l;
    if (t.isAbsolute(u)) {
      if (l = d.existsSync(u), !l) throw new Error("absolute srcpath does not exist");
      return {
        toCwd: u,
        toDst: u
      };
    } else {
      const o = t.dirname(a), s = t.join(o, u);
      if (l = d.existsSync(s), l)
        return {
          toCwd: s,
          toDst: u
        };
      if (l = d.existsSync(u), !l) throw new Error("relative srcpath does not exist");
      return {
        toCwd: u,
        toDst: t.relative(o, u)
      };
    }
  }
  return _n = {
    symlinkPaths: c,
    symlinkPathsSync: f
  }, _n;
}
var Rn, Za;
function Bc() {
  if (Za) return Rn;
  Za = 1;
  const t = je();
  function d(c, f, u) {
    if (u = typeof f == "function" ? f : u, f = typeof f == "function" ? !1 : f, f) return u(null, f);
    t.lstat(c, (a, l) => {
      if (a) return u(null, "file");
      f = l && l.isDirectory() ? "dir" : "file", u(null, f);
    });
  }
  function p(c, f) {
    let u;
    if (f) return f;
    try {
      u = t.lstatSync(c);
    } catch {
      return "file";
    }
    return u && u.isDirectory() ? "dir" : "file";
  }
  return Rn = {
    symlinkType: d,
    symlinkTypeSync: p
  }, Rn;
}
var An, eo;
function Hc() {
  if (eo) return An;
  eo = 1;
  const t = We().fromCallback, d = Ie, p = /* @__PURE__ */ Bt(), c = /* @__PURE__ */ rt(), f = c.mkdirs, u = c.mkdirsSync, a = /* @__PURE__ */ Mc(), l = a.symlinkPaths, o = a.symlinkPathsSync, s = /* @__PURE__ */ Bc(), i = s.symlinkType, r = s.symlinkTypeSync, n = Pt().pathExists, { areIdentical: h } = /* @__PURE__ */ Ht();
  function g(_, T, P, O) {
    O = typeof P == "function" ? P : O, P = typeof P == "function" ? !1 : P, p.lstat(T, (b, I) => {
      !b && I.isSymbolicLink() ? Promise.all([
        p.stat(_),
        p.stat(T)
      ]).then(([S, A]) => {
        if (h(S, A)) return O(null);
        y(_, T, P, O);
      }) : y(_, T, P, O);
    });
  }
  function y(_, T, P, O) {
    l(_, T, (b, I) => {
      if (b) return O(b);
      _ = I.toDst, i(I.toCwd, P, (S, A) => {
        if (S) return O(S);
        const v = d.dirname(T);
        n(v, (k, q) => {
          if (k) return O(k);
          if (q) return p.symlink(_, T, A, O);
          f(v, (x) => {
            if (x) return O(x);
            p.symlink(_, T, A, O);
          });
        });
      });
    });
  }
  function m(_, T, P) {
    let O;
    try {
      O = p.lstatSync(T);
    } catch {
    }
    if (O && O.isSymbolicLink()) {
      const A = p.statSync(_), v = p.statSync(T);
      if (h(A, v)) return;
    }
    const b = o(_, T);
    _ = b.toDst, P = r(b.toCwd, P);
    const I = d.dirname(T);
    return p.existsSync(I) || u(I), p.symlinkSync(_, T, P);
  }
  return An = {
    createSymlink: t(g),
    createSymlinkSync: m
  }, An;
}
var Tn, to;
function jc() {
  if (to) return Tn;
  to = 1;
  const { createFile: t, createFileSync: d } = /* @__PURE__ */ qc(), { createLink: p, createLinkSync: c } = /* @__PURE__ */ $c(), { createSymlink: f, createSymlinkSync: u } = /* @__PURE__ */ Hc();
  return Tn = {
    // file
    createFile: t,
    createFileSync: d,
    ensureFile: t,
    ensureFileSync: d,
    // link
    createLink: p,
    createLinkSync: c,
    ensureLink: p,
    ensureLinkSync: c,
    // symlink
    createSymlink: f,
    createSymlinkSync: u,
    ensureSymlink: f,
    ensureSymlinkSync: u
  }, Tn;
}
var Sn, ro;
function oa() {
  if (ro) return Sn;
  ro = 1;
  function t(p, { EOL: c = `
`, finalEOL: f = !0, replacer: u = null, spaces: a } = {}) {
    const l = f ? c : "";
    return JSON.stringify(p, u, a).replace(/\n/g, c) + l;
  }
  function d(p) {
    return Buffer.isBuffer(p) && (p = p.toString("utf8")), p.replace(/^\uFEFF/, "");
  }
  return Sn = { stringify: t, stripBom: d }, Sn;
}
var Cn, no;
function Gc() {
  if (no) return Cn;
  no = 1;
  let t;
  try {
    t = je();
  } catch {
    t = mt;
  }
  const d = We(), { stringify: p, stripBom: c } = oa();
  async function f(i, r = {}) {
    typeof r == "string" && (r = { encoding: r });
    const n = r.fs || t, h = "throws" in r ? r.throws : !0;
    let g = await d.fromCallback(n.readFile)(i, r);
    g = c(g);
    let y;
    try {
      y = JSON.parse(g, r ? r.reviver : null);
    } catch (m) {
      if (h)
        throw m.message = `${i}: ${m.message}`, m;
      return null;
    }
    return y;
  }
  const u = d.fromPromise(f);
  function a(i, r = {}) {
    typeof r == "string" && (r = { encoding: r });
    const n = r.fs || t, h = "throws" in r ? r.throws : !0;
    try {
      let g = n.readFileSync(i, r);
      return g = c(g), JSON.parse(g, r.reviver);
    } catch (g) {
      if (h)
        throw g.message = `${i}: ${g.message}`, g;
      return null;
    }
  }
  async function l(i, r, n = {}) {
    const h = n.fs || t, g = p(r, n);
    await d.fromCallback(h.writeFile)(i, g, n);
  }
  const o = d.fromPromise(l);
  function s(i, r, n = {}) {
    const h = n.fs || t, g = p(r, n);
    return h.writeFileSync(i, g, n);
  }
  return Cn = {
    readFile: u,
    readFileSync: a,
    writeFile: o,
    writeFileSync: s
  }, Cn;
}
var bn, io;
function Wc() {
  if (io) return bn;
  io = 1;
  const t = Gc();
  return bn = {
    // jsonfile exports
    readJson: t.readFile,
    readJsonSync: t.readFileSync,
    writeJson: t.writeFile,
    writeJsonSync: t.writeFileSync
  }, bn;
}
var Pn, ao;
function sa() {
  if (ao) return Pn;
  ao = 1;
  const t = We().fromCallback, d = je(), p = Ie, c = /* @__PURE__ */ rt(), f = Pt().pathExists;
  function u(l, o, s, i) {
    typeof s == "function" && (i = s, s = "utf8");
    const r = p.dirname(l);
    f(r, (n, h) => {
      if (n) return i(n);
      if (h) return d.writeFile(l, o, s, i);
      c.mkdirs(r, (g) => {
        if (g) return i(g);
        d.writeFile(l, o, s, i);
      });
    });
  }
  function a(l, ...o) {
    const s = p.dirname(l);
    if (d.existsSync(s))
      return d.writeFileSync(l, ...o);
    c.mkdirsSync(s), d.writeFileSync(l, ...o);
  }
  return Pn = {
    outputFile: t(u),
    outputFileSync: a
  }, Pn;
}
var On, oo;
function Vc() {
  if (oo) return On;
  oo = 1;
  const { stringify: t } = oa(), { outputFile: d } = /* @__PURE__ */ sa();
  async function p(c, f, u = {}) {
    const a = t(f, u);
    await d(c, a, u);
  }
  return On = p, On;
}
var In, so;
function Yc() {
  if (so) return In;
  so = 1;
  const { stringify: t } = oa(), { outputFileSync: d } = /* @__PURE__ */ sa();
  function p(c, f, u) {
    const a = t(f, u);
    d(c, a, u);
  }
  return In = p, In;
}
var Dn, lo;
function zc() {
  if (lo) return Dn;
  lo = 1;
  const t = We().fromPromise, d = /* @__PURE__ */ Wc();
  return d.outputJson = t(/* @__PURE__ */ Vc()), d.outputJsonSync = /* @__PURE__ */ Yc(), d.outputJSON = d.outputJson, d.outputJSONSync = d.outputJsonSync, d.writeJSON = d.writeJson, d.writeJSONSync = d.writeJsonSync, d.readJSON = d.readJson, d.readJSONSync = d.readJsonSync, Dn = d, Dn;
}
var Nn, uo;
function Xc() {
  if (uo) return Nn;
  uo = 1;
  const t = je(), d = Ie, p = aa().copy, c = Vr().remove, f = rt().mkdirp, u = Pt().pathExists, a = /* @__PURE__ */ Ht();
  function l(n, h, g, y) {
    typeof g == "function" && (y = g, g = {}), g = g || {};
    const m = g.overwrite || g.clobber || !1;
    a.checkPaths(n, h, "move", g, (_, T) => {
      if (_) return y(_);
      const { srcStat: P, isChangingCase: O = !1 } = T;
      a.checkParentPaths(n, P, h, "move", (b) => {
        if (b) return y(b);
        if (o(h)) return s(n, h, m, O, y);
        f(d.dirname(h), (I) => I ? y(I) : s(n, h, m, O, y));
      });
    });
  }
  function o(n) {
    const h = d.dirname(n);
    return d.parse(h).root === h;
  }
  function s(n, h, g, y, m) {
    if (y) return i(n, h, g, m);
    if (g)
      return c(h, (_) => _ ? m(_) : i(n, h, g, m));
    u(h, (_, T) => _ ? m(_) : T ? m(new Error("dest already exists.")) : i(n, h, g, m));
  }
  function i(n, h, g, y) {
    t.rename(n, h, (m) => m ? m.code !== "EXDEV" ? y(m) : r(n, h, g, y) : y());
  }
  function r(n, h, g, y) {
    p(n, h, {
      overwrite: g,
      errorOnExist: !0
    }, (_) => _ ? y(_) : c(n, y));
  }
  return Nn = l, Nn;
}
var Fn, co;
function Kc() {
  if (co) return Fn;
  co = 1;
  const t = je(), d = Ie, p = aa().copySync, c = Vr().removeSync, f = rt().mkdirpSync, u = /* @__PURE__ */ Ht();
  function a(r, n, h) {
    h = h || {};
    const g = h.overwrite || h.clobber || !1, { srcStat: y, isChangingCase: m = !1 } = u.checkPathsSync(r, n, "move", h);
    return u.checkParentPathsSync(r, y, n, "move"), l(n) || f(d.dirname(n)), o(r, n, g, m);
  }
  function l(r) {
    const n = d.dirname(r);
    return d.parse(n).root === n;
  }
  function o(r, n, h, g) {
    if (g) return s(r, n, h);
    if (h)
      return c(n), s(r, n, h);
    if (t.existsSync(n)) throw new Error("dest already exists.");
    return s(r, n, h);
  }
  function s(r, n, h) {
    try {
      t.renameSync(r, n);
    } catch (g) {
      if (g.code !== "EXDEV") throw g;
      return i(r, n, h);
    }
  }
  function i(r, n, h) {
    return p(r, n, {
      overwrite: h,
      errorOnExist: !0
    }), c(r);
  }
  return Fn = a, Fn;
}
var Ln, fo;
function Jc() {
  if (fo) return Ln;
  fo = 1;
  const t = We().fromCallback;
  return Ln = {
    move: t(/* @__PURE__ */ Xc()),
    moveSync: /* @__PURE__ */ Kc()
  }, Ln;
}
var xn, ho;
function vt() {
  return ho || (ho = 1, xn = {
    // Export promiseified graceful-fs:
    .../* @__PURE__ */ Bt(),
    // Export extra methods:
    .../* @__PURE__ */ aa(),
    .../* @__PURE__ */ kc(),
    .../* @__PURE__ */ jc(),
    .../* @__PURE__ */ zc(),
    .../* @__PURE__ */ rt(),
    .../* @__PURE__ */ Jc(),
    .../* @__PURE__ */ sa(),
    .../* @__PURE__ */ Pt(),
    .../* @__PURE__ */ Vr()
  }), xn;
}
var Vt = {}, Tt = {}, Un = {}, St = {}, po;
function la() {
  if (po) return St;
  po = 1, Object.defineProperty(St, "__esModule", { value: !0 }), St.CancellationError = St.CancellationToken = void 0;
  const t = kl;
  let d = class extends t.EventEmitter {
    get cancelled() {
      return this._cancelled || this._parent != null && this._parent.cancelled;
    }
    set parent(f) {
      this.removeParentCancelHandler(), this._parent = f, this.parentCancelHandler = () => this.cancel(), this._parent.onCancel(this.parentCancelHandler);
    }
    // babel cannot compile ... correctly for super calls
    constructor(f) {
      super(), this.parentCancelHandler = null, this._parent = null, this._cancelled = !1, f != null && (this.parent = f);
    }
    cancel() {
      this._cancelled = !0, this.emit("cancel");
    }
    onCancel(f) {
      this.cancelled ? f() : this.once("cancel", f);
    }
    createPromise(f) {
      if (this.cancelled)
        return Promise.reject(new p());
      const u = () => {
        if (a != null)
          try {
            this.removeListener("cancel", a), a = null;
          } catch {
          }
      };
      let a = null;
      return new Promise((l, o) => {
        let s = null;
        if (a = () => {
          try {
            s != null && (s(), s = null);
          } finally {
            o(new p());
          }
        }, this.cancelled) {
          a();
          return;
        }
        this.onCancel(a), f(l, o, (i) => {
          s = i;
        });
      }).then((l) => (u(), l)).catch((l) => {
        throw u(), l;
      });
    }
    removeParentCancelHandler() {
      const f = this._parent;
      f != null && this.parentCancelHandler != null && (f.removeListener("cancel", this.parentCancelHandler), this.parentCancelHandler = null);
    }
    dispose() {
      try {
        this.removeParentCancelHandler();
      } finally {
        this.removeAllListeners(), this._parent = null;
      }
    }
  };
  St.CancellationToken = d;
  class p extends Error {
    constructor() {
      super("cancelled");
    }
  }
  return St.CancellationError = p, St;
}
var Dr = {}, mo;
function Yr() {
  if (mo) return Dr;
  mo = 1, Object.defineProperty(Dr, "__esModule", { value: !0 }), Dr.newError = t;
  function t(d, p) {
    const c = new Error(d);
    return c.code = p, c;
  }
  return Dr;
}
var ke = {}, Nr = { exports: {} }, Fr = { exports: {} }, kn, go;
function Qc() {
  if (go) return kn;
  go = 1;
  var t = 1e3, d = t * 60, p = d * 60, c = p * 24, f = c * 7, u = c * 365.25;
  kn = function(i, r) {
    r = r || {};
    var n = typeof i;
    if (n === "string" && i.length > 0)
      return a(i);
    if (n === "number" && isFinite(i))
      return r.long ? o(i) : l(i);
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(i)
    );
  };
  function a(i) {
    if (i = String(i), !(i.length > 100)) {
      var r = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        i
      );
      if (r) {
        var n = parseFloat(r[1]), h = (r[2] || "ms").toLowerCase();
        switch (h) {
          case "years":
          case "year":
          case "yrs":
          case "yr":
          case "y":
            return n * u;
          case "weeks":
          case "week":
          case "w":
            return n * f;
          case "days":
          case "day":
          case "d":
            return n * c;
          case "hours":
          case "hour":
          case "hrs":
          case "hr":
          case "h":
            return n * p;
          case "minutes":
          case "minute":
          case "mins":
          case "min":
          case "m":
            return n * d;
          case "seconds":
          case "second":
          case "secs":
          case "sec":
          case "s":
            return n * t;
          case "milliseconds":
          case "millisecond":
          case "msecs":
          case "msec":
          case "ms":
            return n;
          default:
            return;
        }
      }
    }
  }
  function l(i) {
    var r = Math.abs(i);
    return r >= c ? Math.round(i / c) + "d" : r >= p ? Math.round(i / p) + "h" : r >= d ? Math.round(i / d) + "m" : r >= t ? Math.round(i / t) + "s" : i + "ms";
  }
  function o(i) {
    var r = Math.abs(i);
    return r >= c ? s(i, r, c, "day") : r >= p ? s(i, r, p, "hour") : r >= d ? s(i, r, d, "minute") : r >= t ? s(i, r, t, "second") : i + " ms";
  }
  function s(i, r, n, h) {
    var g = r >= n * 1.5;
    return Math.round(i / n) + " " + h + (g ? "s" : "");
  }
  return kn;
}
var qn, vo;
function Hl() {
  if (vo) return qn;
  vo = 1;
  function t(d) {
    c.debug = c, c.default = c, c.coerce = s, c.disable = l, c.enable = u, c.enabled = o, c.humanize = Qc(), c.destroy = i, Object.keys(d).forEach((r) => {
      c[r] = d[r];
    }), c.names = [], c.skips = [], c.formatters = {};
    function p(r) {
      let n = 0;
      for (let h = 0; h < r.length; h++)
        n = (n << 5) - n + r.charCodeAt(h), n |= 0;
      return c.colors[Math.abs(n) % c.colors.length];
    }
    c.selectColor = p;
    function c(r) {
      let n, h = null, g, y;
      function m(..._) {
        if (!m.enabled)
          return;
        const T = m, P = Number(/* @__PURE__ */ new Date()), O = P - (n || P);
        T.diff = O, T.prev = n, T.curr = P, n = P, _[0] = c.coerce(_[0]), typeof _[0] != "string" && _.unshift("%O");
        let b = 0;
        _[0] = _[0].replace(/%([a-zA-Z%])/g, (S, A) => {
          if (S === "%%")
            return "%";
          b++;
          const v = c.formatters[A];
          if (typeof v == "function") {
            const k = _[b];
            S = v.call(T, k), _.splice(b, 1), b--;
          }
          return S;
        }), c.formatArgs.call(T, _), (T.log || c.log).apply(T, _);
      }
      return m.namespace = r, m.useColors = c.useColors(), m.color = c.selectColor(r), m.extend = f, m.destroy = c.destroy, Object.defineProperty(m, "enabled", {
        enumerable: !0,
        configurable: !1,
        get: () => h !== null ? h : (g !== c.namespaces && (g = c.namespaces, y = c.enabled(r)), y),
        set: (_) => {
          h = _;
        }
      }), typeof c.init == "function" && c.init(m), m;
    }
    function f(r, n) {
      const h = c(this.namespace + (typeof n > "u" ? ":" : n) + r);
      return h.log = this.log, h;
    }
    function u(r) {
      c.save(r), c.namespaces = r, c.names = [], c.skips = [];
      const n = (typeof r == "string" ? r : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const h of n)
        h[0] === "-" ? c.skips.push(h.slice(1)) : c.names.push(h);
    }
    function a(r, n) {
      let h = 0, g = 0, y = -1, m = 0;
      for (; h < r.length; )
        if (g < n.length && (n[g] === r[h] || n[g] === "*"))
          n[g] === "*" ? (y = g, m = h, g++) : (h++, g++);
        else if (y !== -1)
          g = y + 1, m++, h = m;
        else
          return !1;
      for (; g < n.length && n[g] === "*"; )
        g++;
      return g === n.length;
    }
    function l() {
      const r = [
        ...c.names,
        ...c.skips.map((n) => "-" + n)
      ].join(",");
      return c.enable(""), r;
    }
    function o(r) {
      for (const n of c.skips)
        if (a(r, n))
          return !1;
      for (const n of c.names)
        if (a(r, n))
          return !0;
      return !1;
    }
    function s(r) {
      return r instanceof Error ? r.stack || r.message : r;
    }
    function i() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    return c.enable(c.load()), c;
  }
  return qn = t, qn;
}
var Eo;
function Zc() {
  return Eo || (Eo = 1, (function(t, d) {
    d.formatArgs = c, d.save = f, d.load = u, d.useColors = p, d.storage = a(), d.destroy = /* @__PURE__ */ (() => {
      let o = !1;
      return () => {
        o || (o = !0, console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."));
      };
    })(), d.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function p() {
      if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
        return !0;
      if (typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))
        return !1;
      let o;
      return typeof document < "u" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window < "u" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator < "u" && navigator.userAgent && (o = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(o[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function c(o) {
      if (o[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + o[0] + (this.useColors ? "%c " : " ") + "+" + t.exports.humanize(this.diff), !this.useColors)
        return;
      const s = "color: " + this.color;
      o.splice(1, 0, s, "color: inherit");
      let i = 0, r = 0;
      o[0].replace(/%[a-zA-Z%]/g, (n) => {
        n !== "%%" && (i++, n === "%c" && (r = i));
      }), o.splice(r, 0, s);
    }
    d.log = console.debug || console.log || (() => {
    });
    function f(o) {
      try {
        o ? d.storage.setItem("debug", o) : d.storage.removeItem("debug");
      } catch {
      }
    }
    function u() {
      let o;
      try {
        o = d.storage.getItem("debug") || d.storage.getItem("DEBUG");
      } catch {
      }
      return !o && typeof process < "u" && "env" in process && (o = process.env.DEBUG), o;
    }
    function a() {
      try {
        return localStorage;
      } catch {
      }
    }
    t.exports = Hl()(d);
    const { formatters: l } = t.exports;
    l.j = function(o) {
      try {
        return JSON.stringify(o);
      } catch (s) {
        return "[UnexpectedJSONParseError]: " + s.message;
      }
    };
  })(Fr, Fr.exports)), Fr.exports;
}
var Lr = { exports: {} }, $n, yo;
function ef() {
  return yo || (yo = 1, $n = (t, d = process.argv) => {
    const p = t.startsWith("-") ? "" : t.length === 1 ? "-" : "--", c = d.indexOf(p + t), f = d.indexOf("--");
    return c !== -1 && (f === -1 || c < f);
  }), $n;
}
var Mn, wo;
function tf() {
  if (wo) return Mn;
  wo = 1;
  const t = Gr, d = ql, p = ef(), { env: c } = process;
  let f;
  p("no-color") || p("no-colors") || p("color=false") || p("color=never") ? f = 0 : (p("color") || p("colors") || p("color=true") || p("color=always")) && (f = 1), "FORCE_COLOR" in c && (c.FORCE_COLOR === "true" ? f = 1 : c.FORCE_COLOR === "false" ? f = 0 : f = c.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(c.FORCE_COLOR, 10), 3));
  function u(o) {
    return o === 0 ? !1 : {
      level: o,
      hasBasic: !0,
      has256: o >= 2,
      has16m: o >= 3
    };
  }
  function a(o, s) {
    if (f === 0)
      return 0;
    if (p("color=16m") || p("color=full") || p("color=truecolor"))
      return 3;
    if (p("color=256"))
      return 2;
    if (o && !s && f === void 0)
      return 0;
    const i = f || 0;
    if (c.TERM === "dumb")
      return i;
    if (process.platform === "win32") {
      const r = t.release().split(".");
      return Number(r[0]) >= 10 && Number(r[2]) >= 10586 ? Number(r[2]) >= 14931 ? 3 : 2 : 1;
    }
    if ("CI" in c)
      return ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((r) => r in c) || c.CI_NAME === "codeship" ? 1 : i;
    if ("TEAMCITY_VERSION" in c)
      return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(c.TEAMCITY_VERSION) ? 1 : 0;
    if (c.COLORTERM === "truecolor")
      return 3;
    if ("TERM_PROGRAM" in c) {
      const r = parseInt((c.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
      switch (c.TERM_PROGRAM) {
        case "iTerm.app":
          return r >= 3 ? 3 : 2;
        case "Apple_Terminal":
          return 2;
      }
    }
    return /-256(color)?$/i.test(c.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(c.TERM) || "COLORTERM" in c ? 1 : i;
  }
  function l(o) {
    const s = a(o, o && o.isTTY);
    return u(s);
  }
  return Mn = {
    supportsColor: l,
    stdout: u(a(!0, d.isatty(1))),
    stderr: u(a(!0, d.isatty(2)))
  }, Mn;
}
var _o;
function rf() {
  return _o || (_o = 1, (function(t, d) {
    const p = ql, c = ia;
    d.init = i, d.log = l, d.formatArgs = u, d.save = o, d.load = s, d.useColors = f, d.destroy = c.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    ), d.colors = [6, 2, 3, 4, 5, 1];
    try {
      const n = tf();
      n && (n.stderr || n).level >= 2 && (d.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ]);
    } catch {
    }
    d.inspectOpts = Object.keys(process.env).filter((n) => /^debug_/i.test(n)).reduce((n, h) => {
      const g = h.substring(6).toLowerCase().replace(/_([a-z])/g, (m, _) => _.toUpperCase());
      let y = process.env[h];
      return /^(yes|on|true|enabled)$/i.test(y) ? y = !0 : /^(no|off|false|disabled)$/i.test(y) ? y = !1 : y === "null" ? y = null : y = Number(y), n[g] = y, n;
    }, {});
    function f() {
      return "colors" in d.inspectOpts ? !!d.inspectOpts.colors : p.isatty(process.stderr.fd);
    }
    function u(n) {
      const { namespace: h, useColors: g } = this;
      if (g) {
        const y = this.color, m = "\x1B[3" + (y < 8 ? y : "8;5;" + y), _ = `  ${m};1m${h} \x1B[0m`;
        n[0] = _ + n[0].split(`
`).join(`
` + _), n.push(m + "m+" + t.exports.humanize(this.diff) + "\x1B[0m");
      } else
        n[0] = a() + h + " " + n[0];
    }
    function a() {
      return d.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function l(...n) {
      return process.stderr.write(c.formatWithOptions(d.inspectOpts, ...n) + `
`);
    }
    function o(n) {
      n ? process.env.DEBUG = n : delete process.env.DEBUG;
    }
    function s() {
      return process.env.DEBUG;
    }
    function i(n) {
      n.inspectOpts = {};
      const h = Object.keys(d.inspectOpts);
      for (let g = 0; g < h.length; g++)
        n.inspectOpts[h[g]] = d.inspectOpts[h[g]];
    }
    t.exports = Hl()(d);
    const { formatters: r } = t.exports;
    r.o = function(n) {
      return this.inspectOpts.colors = this.useColors, c.inspect(n, this.inspectOpts).split(`
`).map((h) => h.trim()).join(" ");
    }, r.O = function(n) {
      return this.inspectOpts.colors = this.useColors, c.inspect(n, this.inspectOpts);
    };
  })(Lr, Lr.exports)), Lr.exports;
}
var Ro;
function nf() {
  return Ro || (Ro = 1, typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? Nr.exports = Zc() : Nr.exports = rf()), Nr.exports;
}
var Yt = {}, Ao;
function jl() {
  if (Ao) return Yt;
  Ao = 1, Object.defineProperty(Yt, "__esModule", { value: !0 }), Yt.ProgressCallbackTransform = void 0;
  const t = vr;
  let d = class extends t.Transform {
    constructor(c, f, u) {
      super(), this.total = c, this.cancellationToken = f, this.onProgress = u, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.nextUpdate = this.start + 1e3;
    }
    _transform(c, f, u) {
      if (this.cancellationToken.cancelled) {
        u(new Error("cancelled"), null);
        return;
      }
      this.transferred += c.length, this.delta += c.length;
      const a = Date.now();
      a >= this.nextUpdate && this.transferred !== this.total && (this.nextUpdate = a + 1e3, this.onProgress({
        total: this.total,
        delta: this.delta,
        transferred: this.transferred,
        percent: this.transferred / this.total * 100,
        bytesPerSecond: Math.round(this.transferred / ((a - this.start) / 1e3))
      }), this.delta = 0), u(null, c);
    }
    _flush(c) {
      if (this.cancellationToken.cancelled) {
        c(new Error("cancelled"));
        return;
      }
      this.onProgress({
        total: this.total,
        delta: this.delta,
        transferred: this.total,
        percent: 100,
        bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
      }), this.delta = 0, c(null);
    }
  };
  return Yt.ProgressCallbackTransform = d, Yt;
}
var To;
function af() {
  if (To) return ke;
  To = 1, Object.defineProperty(ke, "__esModule", { value: !0 }), ke.DigestTransform = ke.HttpExecutor = ke.HttpError = void 0, ke.createHttpError = s, ke.parseJson = n, ke.configureRequestOptionsFromUrl = y, ke.configureRequestUrl = m, ke.safeGetHeader = P, ke.configureRequestOptions = b, ke.safeStringifyJson = I;
  const t = Er, d = nf(), p = mt, c = vr, f = gt, u = la(), a = Yr(), l = jl(), o = (0, d.default)("electron-builder");
  function s(S, A = null) {
    return new r(S.statusCode || -1, `${S.statusCode} ${S.statusMessage}` + (A == null ? "" : `
` + JSON.stringify(A, null, "  ")) + `
Headers: ` + I(S.headers), A);
  }
  const i = /* @__PURE__ */ new Map([
    [429, "Too many requests"],
    [400, "Bad request"],
    [403, "Forbidden"],
    [404, "Not found"],
    [405, "Method not allowed"],
    [406, "Not acceptable"],
    [408, "Request timeout"],
    [413, "Request entity too large"],
    [500, "Internal server error"],
    [502, "Bad gateway"],
    [503, "Service unavailable"],
    [504, "Gateway timeout"],
    [505, "HTTP version not supported"]
  ]);
  class r extends Error {
    constructor(A, v = `HTTP error: ${i.get(A) || A}`, k = null) {
      super(v), this.statusCode = A, this.description = k, this.name = "HttpError", this.code = `HTTP_ERROR_${A}`;
    }
    isServerError() {
      return this.statusCode >= 500 && this.statusCode <= 599;
    }
  }
  ke.HttpError = r;
  function n(S) {
    return S.then((A) => A == null || A.length === 0 ? null : JSON.parse(A));
  }
  class h {
    constructor() {
      this.maxRedirects = 10;
    }
    request(A, v = new u.CancellationToken(), k) {
      b(A);
      const q = k == null ? void 0 : JSON.stringify(k), x = q ? Buffer.from(q) : void 0;
      if (x != null) {
        o(q);
        const { headers: $, ...L } = A;
        A = {
          method: "post",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": x.length,
            ...$
          },
          ...L
        };
      }
      return this.doApiRequest(A, v, ($) => $.end(x));
    }
    doApiRequest(A, v, k, q = 0) {
      return o.enabled && o(`Request: ${I(A)}`), v.createPromise((x, $, L) => {
        const N = this.createRequest(A, (j) => {
          try {
            this.handleResponse(j, A, v, x, $, q, k);
          } catch (D) {
            $(D);
          }
        });
        this.addErrorAndTimeoutHandlers(N, $, A.timeout), this.addRedirectHandlers(N, A, $, q, (j) => {
          this.doApiRequest(j, v, k, q).then(x).catch($);
        }), k(N, $), L(() => N.abort());
      });
    }
    // noinspection JSUnusedLocalSymbols
    // eslint-disable-next-line
    addRedirectHandlers(A, v, k, q, x) {
    }
    addErrorAndTimeoutHandlers(A, v, k = 60 * 1e3) {
      this.addTimeOutHandler(A, v, k), A.on("error", v), A.on("aborted", () => {
        v(new Error("Request has been aborted by the server"));
      });
    }
    handleResponse(A, v, k, q, x, $, L) {
      var N;
      if (o.enabled && o(`Response: ${A.statusCode} ${A.statusMessage}, request options: ${I(v)}`), A.statusCode === 404) {
        x(s(A, `method: ${v.method || "GET"} url: ${v.protocol || "https:"}//${v.hostname}${v.port ? `:${v.port}` : ""}${v.path}

Please double check that your authentication token is correct. Due to security reasons, actual status maybe not reported, but 404.
`));
        return;
      } else if (A.statusCode === 204) {
        q();
        return;
      }
      const j = (N = A.statusCode) !== null && N !== void 0 ? N : 0, D = j >= 300 && j < 400, G = P(A, "location");
      if (D && G != null) {
        if ($ > this.maxRedirects) {
          x(this.createMaxRedirectError());
          return;
        }
        this.doApiRequest(h.prepareRedirectUrlOptions(G, v), k, L, $).then(q).catch(x);
        return;
      }
      A.setEncoding("utf8");
      let V = "";
      A.on("error", x), A.on("data", (te) => V += te), A.on("end", () => {
        try {
          if (A.statusCode != null && A.statusCode >= 400) {
            const te = P(A, "content-type"), de = te != null && (Array.isArray(te) ? te.find((ie) => ie.includes("json")) != null : te.includes("json"));
            x(s(A, `method: ${v.method || "GET"} url: ${v.protocol || "https:"}//${v.hostname}${v.port ? `:${v.port}` : ""}${v.path}

          Data:
          ${de ? JSON.stringify(JSON.parse(V)) : V}
          `));
          } else
            q(V.length === 0 ? null : V);
        } catch (te) {
          x(te);
        }
      });
    }
    async downloadToBuffer(A, v) {
      return await v.cancellationToken.createPromise((k, q, x) => {
        const $ = [], L = {
          headers: v.headers || void 0,
          // because PrivateGitHubProvider requires HttpExecutor.prepareRedirectUrlOptions logic, so, we need to redirect manually
          redirect: "manual"
        };
        m(A, L), b(L), this.doDownload(L, {
          destination: null,
          options: v,
          onCancel: x,
          callback: (N) => {
            N == null ? k(Buffer.concat($)) : q(N);
          },
          responseHandler: (N, j) => {
            let D = 0;
            N.on("data", (G) => {
              if (D += G.length, D > 524288e3) {
                j(new Error("Maximum allowed size is 500 MB"));
                return;
              }
              $.push(G);
            }), N.on("end", () => {
              j(null);
            });
          }
        }, 0);
      });
    }
    doDownload(A, v, k) {
      const q = this.createRequest(A, (x) => {
        if (x.statusCode >= 400) {
          v.callback(new Error(`Cannot download "${A.protocol || "https:"}//${A.hostname}${A.path}", status ${x.statusCode}: ${x.statusMessage}`));
          return;
        }
        x.on("error", v.callback);
        const $ = P(x, "location");
        if ($ != null) {
          k < this.maxRedirects ? this.doDownload(h.prepareRedirectUrlOptions($, A), v, k++) : v.callback(this.createMaxRedirectError());
          return;
        }
        v.responseHandler == null ? O(v, x) : v.responseHandler(x, v.callback);
      });
      this.addErrorAndTimeoutHandlers(q, v.callback, A.timeout), this.addRedirectHandlers(q, A, v.callback, k, (x) => {
        this.doDownload(x, v, k++);
      }), q.end();
    }
    createMaxRedirectError() {
      return new Error(`Too many redirects (> ${this.maxRedirects})`);
    }
    addTimeOutHandler(A, v, k) {
      A.on("socket", (q) => {
        q.setTimeout(k, () => {
          A.abort(), v(new Error("Request timed out"));
        });
      });
    }
    static prepareRedirectUrlOptions(A, v) {
      const k = y(A, { ...v }), q = k.headers;
      if (q?.authorization) {
        const x = h.reconstructOriginalUrl(v), $ = g(A, v);
        h.isCrossOriginRedirect(x, $) && (o.enabled && o(`Given the cross-origin redirect (from ${x.host} to ${$.host}), the Authorization header will be stripped out.`), delete q.authorization);
      }
      return k;
    }
    static reconstructOriginalUrl(A) {
      const v = A.protocol || "https:";
      if (!A.hostname)
        throw new Error("Missing hostname in request options");
      const k = A.hostname, q = A.port ? `:${A.port}` : "", x = A.path || "/";
      return new f.URL(`${v}//${k}${q}${x}`);
    }
    static isCrossOriginRedirect(A, v) {
      if (A.hostname.toLowerCase() !== v.hostname.toLowerCase())
        return !0;
      if (A.protocol === "http:" && // This can be replaced with `!originalUrl.port`, but for the sake of clarity.
      ["80", ""].includes(A.port) && v.protocol === "https:" && // This can be replaced with `!redirectUrl.port`, but for the sake of clarity.
      ["443", ""].includes(v.port))
        return !1;
      if (A.protocol !== v.protocol)
        return !0;
      const k = A.port, q = v.port;
      return k !== q;
    }
    static retryOnServerError(A, v = 3) {
      for (let k = 0; ; k++)
        try {
          return A();
        } catch (q) {
          if (k < v && (q instanceof r && q.isServerError() || q.code === "EPIPE"))
            continue;
          throw q;
        }
    }
  }
  ke.HttpExecutor = h;
  function g(S, A) {
    try {
      return new f.URL(S);
    } catch {
      const v = A.hostname, k = A.protocol || "https:", q = A.port ? `:${A.port}` : "", x = `${k}//${v}${q}`;
      return new f.URL(S, x);
    }
  }
  function y(S, A) {
    const v = b(A), k = g(S, A);
    return m(k, v), v;
  }
  function m(S, A) {
    A.protocol = S.protocol, A.hostname = S.hostname, S.port ? A.port = S.port : A.port && delete A.port, A.path = S.pathname + S.search;
  }
  class _ extends c.Transform {
    // noinspection JSUnusedGlobalSymbols
    get actual() {
      return this._actual;
    }
    constructor(A, v = "sha512", k = "base64") {
      super(), this.expected = A, this.algorithm = v, this.encoding = k, this._actual = null, this.isValidateOnEnd = !0, this.digester = (0, t.createHash)(v);
    }
    // noinspection JSUnusedGlobalSymbols
    _transform(A, v, k) {
      this.digester.update(A), k(null, A);
    }
    // noinspection JSUnusedGlobalSymbols
    _flush(A) {
      if (this._actual = this.digester.digest(this.encoding), this.isValidateOnEnd)
        try {
          this.validate();
        } catch (v) {
          A(v);
          return;
        }
      A(null);
    }
    validate() {
      if (this._actual == null)
        throw (0, a.newError)("Not finished yet", "ERR_STREAM_NOT_FINISHED");
      if (this._actual !== this.expected)
        throw (0, a.newError)(`${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`, "ERR_CHECKSUM_MISMATCH");
      return null;
    }
  }
  ke.DigestTransform = _;
  function T(S, A, v) {
    return S != null && A != null && S !== A ? (v(new Error(`checksum mismatch: expected ${A} but got ${S} (X-Checksum-Sha2 header)`)), !1) : !0;
  }
  function P(S, A) {
    const v = S.headers[A];
    return v == null ? null : Array.isArray(v) ? v.length === 0 ? null : v[v.length - 1] : v;
  }
  function O(S, A) {
    if (!T(P(A, "X-Checksum-Sha2"), S.options.sha2, S.callback))
      return;
    const v = [];
    if (S.options.onProgress != null) {
      const $ = P(A, "content-length");
      $ != null && v.push(new l.ProgressCallbackTransform(parseInt($, 10), S.options.cancellationToken, S.options.onProgress));
    }
    const k = S.options.sha512;
    k != null ? v.push(new _(k, "sha512", k.length === 128 && !k.includes("+") && !k.includes("Z") && !k.includes("=") ? "hex" : "base64")) : S.options.sha2 != null && v.push(new _(S.options.sha2, "sha256", "hex"));
    const q = (0, p.createWriteStream)(S.destination);
    v.push(q);
    let x = A;
    for (const $ of v)
      $.on("error", (L) => {
        q.close(), S.options.cancellationToken.cancelled || S.callback(L);
      }), x = x.pipe($);
    q.on("finish", () => {
      q.close(S.callback);
    });
  }
  function b(S, A, v) {
    v != null && (S.method = v), S.headers = { ...S.headers };
    const k = S.headers;
    return A != null && (k.authorization = A.startsWith("Basic") || A.startsWith("Bearer") ? A : `token ${A}`), k["User-Agent"] == null && (k["User-Agent"] = "electron-builder"), (v == null || v === "GET" || k["Cache-Control"] == null) && (k["Cache-Control"] = "no-cache"), S.protocol == null && process.versions.electron != null && (S.protocol = "https:"), S;
  }
  function I(S, A) {
    return JSON.stringify(S, (v, k) => v.endsWith("Authorization") || v.endsWith("authorization") || v.endsWith("Password") || v.endsWith("PASSWORD") || v.endsWith("Token") || v.includes("password") || v.includes("token") || A != null && A.has(v) ? "<stripped sensitive data>" : k, 2);
  }
  return ke;
}
var zt = {}, So;
function of() {
  if (So) return zt;
  So = 1, Object.defineProperty(zt, "__esModule", { value: !0 }), zt.MemoLazy = void 0;
  let t = class {
    constructor(c, f) {
      this.selector = c, this.creator = f, this.selected = void 0, this._value = void 0;
    }
    get hasValue() {
      return this._value !== void 0;
    }
    get value() {
      const c = this.selector();
      if (this._value !== void 0 && d(this.selected, c))
        return this._value;
      this.selected = c;
      const f = this.creator(c);
      return this.value = f, f;
    }
    set value(c) {
      this._value = c;
    }
  };
  zt.MemoLazy = t;
  function d(p, c) {
    if (typeof p == "object" && p !== null && (typeof c == "object" && c !== null)) {
      const a = Object.keys(p), l = Object.keys(c);
      return a.length === l.length && a.every((o) => d(p[o], c[o]));
    }
    return p === c;
  }
  return zt;
}
var Lt = {}, Co;
function sf() {
  if (Co) return Lt;
  Co = 1, Object.defineProperty(Lt, "__esModule", { value: !0 }), Lt.githubUrl = t, Lt.githubTagPrefix = d, Lt.getS3LikeProviderBaseUrl = p;
  function t(a, l = "github.com") {
    return `${a.protocol || "https"}://${a.host || l}`;
  }
  function d(a) {
    var l;
    return a.tagNamePrefix ? a.tagNamePrefix : !((l = a.vPrefixedTagName) !== null && l !== void 0) || l ? "v" : "";
  }
  function p(a) {
    const l = a.provider;
    if (l === "s3")
      return c(a);
    if (l === "spaces")
      return u(a);
    throw new Error(`Not supported provider: ${l}`);
  }
  function c(a) {
    let l;
    if (a.accelerate == !0)
      l = `https://${a.bucket}.s3-accelerate.amazonaws.com`;
    else if (a.endpoint != null)
      l = `${a.endpoint}/${a.bucket}`;
    else if (a.bucket.includes(".")) {
      if (a.region == null)
        throw new Error(`Bucket name "${a.bucket}" includes a dot, but S3 region is missing`);
      a.region === "us-east-1" ? l = `https://s3.amazonaws.com/${a.bucket}` : l = `https://s3-${a.region}.amazonaws.com/${a.bucket}`;
    } else a.region === "cn-north-1" ? l = `https://${a.bucket}.s3.${a.region}.amazonaws.com.cn` : l = `https://${a.bucket}.s3.amazonaws.com`;
    return f(l, a.path);
  }
  function f(a, l) {
    return l != null && l.length > 0 && (l.startsWith("/") || (a += "/"), a += l), a;
  }
  function u(a) {
    if (a.name == null)
      throw new Error("name is missing");
    if (a.region == null)
      throw new Error("region is missing");
    return f(`https://${a.name}.${a.region}.digitaloceanspaces.com`, a.path);
  }
  return Lt;
}
var xr = {}, bo;
function lf() {
  if (bo) return xr;
  bo = 1, Object.defineProperty(xr, "__esModule", { value: !0 }), xr.retry = d;
  const t = la();
  async function d(p, c) {
    var f;
    const { retries: u, interval: a, backoff: l = 0, attempt: o = 0, shouldRetry: s, cancellationToken: i = new t.CancellationToken() } = c;
    try {
      return await p();
    } catch (r) {
      if (await Promise.resolve((f = s?.(r)) !== null && f !== void 0 ? f : !0) && u > 0 && !i.cancelled)
        return await new Promise((n) => setTimeout(n, a + l * o)), await d(p, { ...c, retries: u - 1, attempt: o + 1 });
      throw r;
    }
  }
  return xr;
}
var Ur = {}, Po;
function uf() {
  if (Po) return Ur;
  Po = 1, Object.defineProperty(Ur, "__esModule", { value: !0 }), Ur.parseDn = t;
  function t(d) {
    let p = !1, c = null, f = "", u = 0;
    d = d.trim();
    const a = /* @__PURE__ */ new Map();
    for (let l = 0; l <= d.length; l++) {
      if (l === d.length) {
        c !== null && a.set(c, f);
        break;
      }
      const o = d[l];
      if (p) {
        if (o === '"') {
          p = !1;
          continue;
        }
      } else {
        if (o === '"') {
          p = !0;
          continue;
        }
        if (o === "\\") {
          l++;
          const s = parseInt(d.slice(l, l + 2), 16);
          Number.isNaN(s) ? f += d[l] : (l++, f += String.fromCharCode(s));
          continue;
        }
        if (c === null && o === "=") {
          c = f, f = "";
          continue;
        }
        if (o === "," || o === ";" || o === "+") {
          c !== null && a.set(c, f), c = null, f = "";
          continue;
        }
      }
      if (o === " " && !p) {
        if (f.length === 0)
          continue;
        if (l > u) {
          let s = l;
          for (; d[s] === " "; )
            s++;
          u = s;
        }
        if (u >= d.length || d[u] === "," || d[u] === ";" || c === null && d[u] === "=" || c !== null && d[u] === "+") {
          l = u - 1;
          continue;
        }
      }
      f += o;
    }
    return a;
  }
  return Ur;
}
var Ct = {}, Oo;
function cf() {
  if (Oo) return Ct;
  Oo = 1, Object.defineProperty(Ct, "__esModule", { value: !0 }), Ct.nil = Ct.UUID = void 0;
  const t = Er, d = Yr(), p = "options.name must be either a string or a Buffer", c = (0, t.randomBytes)(16);
  c[0] = c[0] | 1;
  const f = {}, u = [];
  for (let r = 0; r < 256; r++) {
    const n = (r + 256).toString(16).substr(1);
    f[n] = r, u[r] = n;
  }
  class a {
    constructor(n) {
      this.ascii = null, this.binary = null;
      const h = a.check(n);
      if (!h)
        throw new Error("not a UUID");
      this.version = h.version, h.format === "ascii" ? this.ascii = n : this.binary = n;
    }
    static v5(n, h) {
      return s(n, "sha1", 80, h);
    }
    toString() {
      return this.ascii == null && (this.ascii = i(this.binary)), this.ascii;
    }
    inspect() {
      return `UUID v${this.version} ${this.toString()}`;
    }
    static check(n, h = 0) {
      if (typeof n == "string")
        return n = n.toLowerCase(), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-([a-f0-9]{12})$/.test(n) ? n === "00000000-0000-0000-0000-000000000000" ? { version: void 0, variant: "nil", format: "ascii" } : {
          version: (f[n[14] + n[15]] & 240) >> 4,
          variant: l((f[n[19] + n[20]] & 224) >> 5),
          format: "ascii"
        } : !1;
      if (Buffer.isBuffer(n)) {
        if (n.length < h + 16)
          return !1;
        let g = 0;
        for (; g < 16 && n[h + g] === 0; g++)
          ;
        return g === 16 ? { version: void 0, variant: "nil", format: "binary" } : {
          version: (n[h + 6] & 240) >> 4,
          variant: l((n[h + 8] & 224) >> 5),
          format: "binary"
        };
      }
      throw (0, d.newError)("Unknown type of uuid", "ERR_UNKNOWN_UUID_TYPE");
    }
    // read stringified uuid into a Buffer
    static parse(n) {
      const h = Buffer.allocUnsafe(16);
      let g = 0;
      for (let y = 0; y < 16; y++)
        h[y] = f[n[g++] + n[g++]], (y === 3 || y === 5 || y === 7 || y === 9) && (g += 1);
      return h;
    }
  }
  Ct.UUID = a, a.OID = a.parse("6ba7b812-9dad-11d1-80b4-00c04fd430c8");
  function l(r) {
    switch (r) {
      case 0:
      case 1:
      case 3:
        return "ncs";
      case 4:
      case 5:
        return "rfc4122";
      case 6:
        return "microsoft";
      default:
        return "future";
    }
  }
  var o;
  (function(r) {
    r[r.ASCII = 0] = "ASCII", r[r.BINARY = 1] = "BINARY", r[r.OBJECT = 2] = "OBJECT";
  })(o || (o = {}));
  function s(r, n, h, g, y = o.ASCII) {
    const m = (0, t.createHash)(n);
    if (typeof r != "string" && !Buffer.isBuffer(r))
      throw (0, d.newError)(p, "ERR_INVALID_UUID_NAME");
    m.update(g), m.update(r);
    const T = m.digest();
    let P;
    switch (y) {
      case o.BINARY:
        T[6] = T[6] & 15 | h, T[8] = T[8] & 63 | 128, P = T;
        break;
      case o.OBJECT:
        T[6] = T[6] & 15 | h, T[8] = T[8] & 63 | 128, P = new a(T);
        break;
      default:
        P = u[T[0]] + u[T[1]] + u[T[2]] + u[T[3]] + "-" + u[T[4]] + u[T[5]] + "-" + u[T[6] & 15 | h] + u[T[7]] + "-" + u[T[8] & 63 | 128] + u[T[9]] + "-" + u[T[10]] + u[T[11]] + u[T[12]] + u[T[13]] + u[T[14]] + u[T[15]];
        break;
    }
    return P;
  }
  function i(r) {
    return u[r[0]] + u[r[1]] + u[r[2]] + u[r[3]] + "-" + u[r[4]] + u[r[5]] + "-" + u[r[6]] + u[r[7]] + "-" + u[r[8]] + u[r[9]] + "-" + u[r[10]] + u[r[11]] + u[r[12]] + u[r[13]] + u[r[14]] + u[r[15]];
  }
  return Ct.nil = new a("00000000-0000-0000-0000-000000000000"), Ct;
}
var xt = {}, Bn = {}, Io;
function ff() {
  return Io || (Io = 1, (function(t) {
    (function(d) {
      d.parser = function(w, E) {
        return new c(w, E);
      }, d.SAXParser = c, d.SAXStream = i, d.createStream = s, d.MAX_BUFFER_LENGTH = 64 * 1024;
      var p = [
        "comment",
        "sgmlDecl",
        "textNode",
        "tagName",
        "doctype",
        "procInstName",
        "procInstBody",
        "entity",
        "attribName",
        "attribValue",
        "cdata",
        "script"
      ];
      d.EVENTS = [
        "text",
        "processinginstruction",
        "sgmldeclaration",
        "doctype",
        "comment",
        "opentagstart",
        "attribute",
        "opentag",
        "closetag",
        "opencdata",
        "cdata",
        "closecdata",
        "error",
        "end",
        "ready",
        "script",
        "opennamespace",
        "closenamespace"
      ];
      function c(w, E) {
        if (!(this instanceof c))
          return new c(w, E);
        var H = this;
        u(H), H.q = H.c = "", H.bufferCheckPosition = d.MAX_BUFFER_LENGTH, H.opt = E || {}, H.opt.lowercase = H.opt.lowercase || H.opt.lowercasetags, H.looseCase = H.opt.lowercase ? "toLowerCase" : "toUpperCase", H.tags = [], H.closed = H.closedRoot = H.sawRoot = !1, H.tag = H.error = null, H.strict = !!w, H.noscript = !!(w || H.opt.noscript), H.state = v.BEGIN, H.strictEntities = H.opt.strictEntities, H.ENTITIES = H.strictEntities ? Object.create(d.XML_ENTITIES) : Object.create(d.ENTITIES), H.attribList = [], H.opt.xmlns && (H.ns = Object.create(y)), H.opt.unquotedAttributeValues === void 0 && (H.opt.unquotedAttributeValues = !w), H.trackPosition = H.opt.position !== !1, H.trackPosition && (H.position = H.line = H.column = 0), q(H, "onready");
      }
      Object.create || (Object.create = function(w) {
        function E() {
        }
        E.prototype = w;
        var H = new E();
        return H;
      }), Object.keys || (Object.keys = function(w) {
        var E = [];
        for (var H in w) w.hasOwnProperty(H) && E.push(H);
        return E;
      });
      function f(w) {
        for (var E = Math.max(d.MAX_BUFFER_LENGTH, 10), H = 0, F = 0, ce = p.length; F < ce; F++) {
          var he = w[p[F]].length;
          if (he > E)
            switch (p[F]) {
              case "textNode":
                $(w);
                break;
              case "cdata":
                x(w, "oncdata", w.cdata), w.cdata = "";
                break;
              case "script":
                x(w, "onscript", w.script), w.script = "";
                break;
              default:
                N(w, "Max buffer length exceeded: " + p[F]);
            }
          H = Math.max(H, he);
        }
        var pe = d.MAX_BUFFER_LENGTH - H;
        w.bufferCheckPosition = pe + w.position;
      }
      function u(w) {
        for (var E = 0, H = p.length; E < H; E++)
          w[p[E]] = "";
      }
      function a(w) {
        $(w), w.cdata !== "" && (x(w, "oncdata", w.cdata), w.cdata = ""), w.script !== "" && (x(w, "onscript", w.script), w.script = "");
      }
      c.prototype = {
        end: function() {
          j(this);
        },
        write: ge,
        resume: function() {
          return this.error = null, this;
        },
        close: function() {
          return this.write(null);
        },
        flush: function() {
          a(this);
        }
      };
      var l;
      try {
        l = require("stream").Stream;
      } catch {
        l = function() {
        };
      }
      l || (l = function() {
      });
      var o = d.EVENTS.filter(function(w) {
        return w !== "error" && w !== "end";
      });
      function s(w, E) {
        return new i(w, E);
      }
      function i(w, E) {
        if (!(this instanceof i))
          return new i(w, E);
        l.apply(this), this._parser = new c(w, E), this.writable = !0, this.readable = !0;
        var H = this;
        this._parser.onend = function() {
          H.emit("end");
        }, this._parser.onerror = function(F) {
          H.emit("error", F), H._parser.error = null;
        }, this._decoder = null, o.forEach(function(F) {
          Object.defineProperty(H, "on" + F, {
            get: function() {
              return H._parser["on" + F];
            },
            set: function(ce) {
              if (!ce)
                return H.removeAllListeners(F), H._parser["on" + F] = ce, ce;
              H.on(F, ce);
            },
            enumerable: !0,
            configurable: !1
          });
        });
      }
      i.prototype = Object.create(l.prototype, {
        constructor: {
          value: i
        }
      }), i.prototype.write = function(w) {
        return typeof Buffer == "function" && typeof Buffer.isBuffer == "function" && Buffer.isBuffer(w) && (this._decoder || (this._decoder = new TextDecoder("utf8")), w = this._decoder.decode(w, { stream: !0 })), this._parser.write(w.toString()), this.emit("data", w), !0;
      }, i.prototype.end = function(w) {
        if (w && w.length && this.write(w), this._decoder) {
          var E = this._decoder.decode();
          E && (this._parser.write(E), this.emit("data", E));
        }
        return this._parser.end(), !0;
      }, i.prototype.on = function(w, E) {
        var H = this;
        return !H._parser["on" + w] && o.indexOf(w) !== -1 && (H._parser["on" + w] = function() {
          var F = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
          F.splice(0, 0, w), H.emit.apply(H, F);
        }), l.prototype.on.call(H, w, E);
      };
      var r = "[CDATA[", n = "DOCTYPE", h = "http://www.w3.org/XML/1998/namespace", g = "http://www.w3.org/2000/xmlns/", y = { xml: h, xmlns: g }, m = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, _ = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/, T = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/, P = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
      function O(w) {
        return w === " " || w === `
` || w === "\r" || w === "	";
      }
      function b(w) {
        return w === '"' || w === "'";
      }
      function I(w) {
        return w === ">" || O(w);
      }
      function S(w, E) {
        return w.test(E);
      }
      function A(w, E) {
        return !S(w, E);
      }
      var v = 0;
      d.STATE = {
        BEGIN: v++,
        // leading byte order mark or whitespace
        BEGIN_WHITESPACE: v++,
        // leading whitespace
        TEXT: v++,
        // general stuff
        TEXT_ENTITY: v++,
        // &amp and such.
        OPEN_WAKA: v++,
        // <
        SGML_DECL: v++,
        // <!BLARG
        SGML_DECL_QUOTED: v++,
        // <!BLARG foo "bar
        DOCTYPE: v++,
        // <!DOCTYPE
        DOCTYPE_QUOTED: v++,
        // <!DOCTYPE "//blah
        DOCTYPE_DTD: v++,
        // <!DOCTYPE "//blah" [ ...
        DOCTYPE_DTD_QUOTED: v++,
        // <!DOCTYPE "//blah" [ "foo
        COMMENT_STARTING: v++,
        // <!-
        COMMENT: v++,
        // <!--
        COMMENT_ENDING: v++,
        // <!-- blah -
        COMMENT_ENDED: v++,
        // <!-- blah --
        CDATA: v++,
        // <![CDATA[ something
        CDATA_ENDING: v++,
        // ]
        CDATA_ENDING_2: v++,
        // ]]
        PROC_INST: v++,
        // <?hi
        PROC_INST_BODY: v++,
        // <?hi there
        PROC_INST_ENDING: v++,
        // <?hi "there" ?
        OPEN_TAG: v++,
        // <strong
        OPEN_TAG_SLASH: v++,
        // <strong /
        ATTRIB: v++,
        // <a
        ATTRIB_NAME: v++,
        // <a foo
        ATTRIB_NAME_SAW_WHITE: v++,
        // <a foo _
        ATTRIB_VALUE: v++,
        // <a foo=
        ATTRIB_VALUE_QUOTED: v++,
        // <a foo="bar
        ATTRIB_VALUE_CLOSED: v++,
        // <a foo="bar"
        ATTRIB_VALUE_UNQUOTED: v++,
        // <a foo=bar
        ATTRIB_VALUE_ENTITY_Q: v++,
        // <foo bar="&quot;"
        ATTRIB_VALUE_ENTITY_U: v++,
        // <foo bar=&quot
        CLOSE_TAG: v++,
        // </a
        CLOSE_TAG_SAW_WHITE: v++,
        // </a   >
        SCRIPT: v++,
        // <script> ...
        SCRIPT_ENDING: v++
        // <script> ... <
      }, d.XML_ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'"
      }, d.ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'",
        AElig: 198,
        Aacute: 193,
        Acirc: 194,
        Agrave: 192,
        Aring: 197,
        Atilde: 195,
        Auml: 196,
        Ccedil: 199,
        ETH: 208,
        Eacute: 201,
        Ecirc: 202,
        Egrave: 200,
        Euml: 203,
        Iacute: 205,
        Icirc: 206,
        Igrave: 204,
        Iuml: 207,
        Ntilde: 209,
        Oacute: 211,
        Ocirc: 212,
        Ograve: 210,
        Oslash: 216,
        Otilde: 213,
        Ouml: 214,
        THORN: 222,
        Uacute: 218,
        Ucirc: 219,
        Ugrave: 217,
        Uuml: 220,
        Yacute: 221,
        aacute: 225,
        acirc: 226,
        aelig: 230,
        agrave: 224,
        aring: 229,
        atilde: 227,
        auml: 228,
        ccedil: 231,
        eacute: 233,
        ecirc: 234,
        egrave: 232,
        eth: 240,
        euml: 235,
        iacute: 237,
        icirc: 238,
        igrave: 236,
        iuml: 239,
        ntilde: 241,
        oacute: 243,
        ocirc: 244,
        ograve: 242,
        oslash: 248,
        otilde: 245,
        ouml: 246,
        szlig: 223,
        thorn: 254,
        uacute: 250,
        ucirc: 251,
        ugrave: 249,
        uuml: 252,
        yacute: 253,
        yuml: 255,
        copy: 169,
        reg: 174,
        nbsp: 160,
        iexcl: 161,
        cent: 162,
        pound: 163,
        curren: 164,
        yen: 165,
        brvbar: 166,
        sect: 167,
        uml: 168,
        ordf: 170,
        laquo: 171,
        not: 172,
        shy: 173,
        macr: 175,
        deg: 176,
        plusmn: 177,
        sup1: 185,
        sup2: 178,
        sup3: 179,
        acute: 180,
        micro: 181,
        para: 182,
        middot: 183,
        cedil: 184,
        ordm: 186,
        raquo: 187,
        frac14: 188,
        frac12: 189,
        frac34: 190,
        iquest: 191,
        times: 215,
        divide: 247,
        OElig: 338,
        oelig: 339,
        Scaron: 352,
        scaron: 353,
        Yuml: 376,
        fnof: 402,
        circ: 710,
        tilde: 732,
        Alpha: 913,
        Beta: 914,
        Gamma: 915,
        Delta: 916,
        Epsilon: 917,
        Zeta: 918,
        Eta: 919,
        Theta: 920,
        Iota: 921,
        Kappa: 922,
        Lambda: 923,
        Mu: 924,
        Nu: 925,
        Xi: 926,
        Omicron: 927,
        Pi: 928,
        Rho: 929,
        Sigma: 931,
        Tau: 932,
        Upsilon: 933,
        Phi: 934,
        Chi: 935,
        Psi: 936,
        Omega: 937,
        alpha: 945,
        beta: 946,
        gamma: 947,
        delta: 948,
        epsilon: 949,
        zeta: 950,
        eta: 951,
        theta: 952,
        iota: 953,
        kappa: 954,
        lambda: 955,
        mu: 956,
        nu: 957,
        xi: 958,
        omicron: 959,
        pi: 960,
        rho: 961,
        sigmaf: 962,
        sigma: 963,
        tau: 964,
        upsilon: 965,
        phi: 966,
        chi: 967,
        psi: 968,
        omega: 969,
        thetasym: 977,
        upsih: 978,
        piv: 982,
        ensp: 8194,
        emsp: 8195,
        thinsp: 8201,
        zwnj: 8204,
        zwj: 8205,
        lrm: 8206,
        rlm: 8207,
        ndash: 8211,
        mdash: 8212,
        lsquo: 8216,
        rsquo: 8217,
        sbquo: 8218,
        ldquo: 8220,
        rdquo: 8221,
        bdquo: 8222,
        dagger: 8224,
        Dagger: 8225,
        bull: 8226,
        hellip: 8230,
        permil: 8240,
        prime: 8242,
        Prime: 8243,
        lsaquo: 8249,
        rsaquo: 8250,
        oline: 8254,
        frasl: 8260,
        euro: 8364,
        image: 8465,
        weierp: 8472,
        real: 8476,
        trade: 8482,
        alefsym: 8501,
        larr: 8592,
        uarr: 8593,
        rarr: 8594,
        darr: 8595,
        harr: 8596,
        crarr: 8629,
        lArr: 8656,
        uArr: 8657,
        rArr: 8658,
        dArr: 8659,
        hArr: 8660,
        forall: 8704,
        part: 8706,
        exist: 8707,
        empty: 8709,
        nabla: 8711,
        isin: 8712,
        notin: 8713,
        ni: 8715,
        prod: 8719,
        sum: 8721,
        minus: 8722,
        lowast: 8727,
        radic: 8730,
        prop: 8733,
        infin: 8734,
        ang: 8736,
        and: 8743,
        or: 8744,
        cap: 8745,
        cup: 8746,
        int: 8747,
        there4: 8756,
        sim: 8764,
        cong: 8773,
        asymp: 8776,
        ne: 8800,
        equiv: 8801,
        le: 8804,
        ge: 8805,
        sub: 8834,
        sup: 8835,
        nsub: 8836,
        sube: 8838,
        supe: 8839,
        oplus: 8853,
        otimes: 8855,
        perp: 8869,
        sdot: 8901,
        lceil: 8968,
        rceil: 8969,
        lfloor: 8970,
        rfloor: 8971,
        lang: 9001,
        rang: 9002,
        loz: 9674,
        spades: 9824,
        clubs: 9827,
        hearts: 9829,
        diams: 9830
      }, Object.keys(d.ENTITIES).forEach(function(w) {
        var E = d.ENTITIES[w], H = typeof E == "number" ? String.fromCharCode(E) : E;
        d.ENTITIES[w] = H;
      });
      for (var k in d.STATE)
        d.STATE[d.STATE[k]] = k;
      v = d.STATE;
      function q(w, E, H) {
        w[E] && w[E](H);
      }
      function x(w, E, H) {
        w.textNode && $(w), q(w, E, H);
      }
      function $(w) {
        w.textNode = L(w.opt, w.textNode), w.textNode && q(w, "ontext", w.textNode), w.textNode = "";
      }
      function L(w, E) {
        return w.trim && (E = E.trim()), w.normalize && (E = E.replace(/\s+/g, " ")), E;
      }
      function N(w, E) {
        return $(w), w.trackPosition && (E += `
Line: ` + w.line + `
Column: ` + w.column + `
Char: ` + w.c), E = new Error(E), w.error = E, q(w, "onerror", E), w;
      }
      function j(w) {
        return w.sawRoot && !w.closedRoot && D(w, "Unclosed root tag"), w.state !== v.BEGIN && w.state !== v.BEGIN_WHITESPACE && w.state !== v.TEXT && N(w, "Unexpected end"), $(w), w.c = "", w.closed = !0, q(w, "onend"), c.call(w, w.strict, w.opt), w;
      }
      function D(w, E) {
        if (typeof w != "object" || !(w instanceof c))
          throw new Error("bad call to strictFail");
        w.strict && N(w, E);
      }
      function G(w) {
        w.strict || (w.tagName = w.tagName[w.looseCase]());
        var E = w.tags[w.tags.length - 1] || w, H = w.tag = { name: w.tagName, attributes: {} };
        w.opt.xmlns && (H.ns = E.ns), w.attribList.length = 0, x(w, "onopentagstart", H);
      }
      function V(w, E) {
        var H = w.indexOf(":"), F = H < 0 ? ["", w] : w.split(":"), ce = F[0], he = F[1];
        return E && w === "xmlns" && (ce = "xmlns", he = ""), { prefix: ce, local: he };
      }
      function te(w) {
        if (w.strict || (w.attribName = w.attribName[w.looseCase]()), w.attribList.indexOf(w.attribName) !== -1 || w.tag.attributes.hasOwnProperty(w.attribName)) {
          w.attribName = w.attribValue = "";
          return;
        }
        if (w.opt.xmlns) {
          var E = V(w.attribName, !0), H = E.prefix, F = E.local;
          if (H === "xmlns")
            if (F === "xml" && w.attribValue !== h)
              D(
                w,
                "xml: prefix must be bound to " + h + `
Actual: ` + w.attribValue
              );
            else if (F === "xmlns" && w.attribValue !== g)
              D(
                w,
                "xmlns: prefix must be bound to " + g + `
Actual: ` + w.attribValue
              );
            else {
              var ce = w.tag, he = w.tags[w.tags.length - 1] || w;
              ce.ns === he.ns && (ce.ns = Object.create(he.ns)), ce.ns[F] = w.attribValue;
            }
          w.attribList.push([w.attribName, w.attribValue]);
        } else
          w.tag.attributes[w.attribName] = w.attribValue, x(w, "onattribute", {
            name: w.attribName,
            value: w.attribValue
          });
        w.attribName = w.attribValue = "";
      }
      function de(w, E) {
        if (w.opt.xmlns) {
          var H = w.tag, F = V(w.tagName);
          H.prefix = F.prefix, H.local = F.local, H.uri = H.ns[F.prefix] || "", H.prefix && !H.uri && (D(
            w,
            "Unbound namespace prefix: " + JSON.stringify(w.tagName)
          ), H.uri = F.prefix);
          var ce = w.tags[w.tags.length - 1] || w;
          H.ns && ce.ns !== H.ns && Object.keys(H.ns).forEach(function(e) {
            x(w, "onopennamespace", {
              prefix: e,
              uri: H.ns[e]
            });
          });
          for (var he = 0, pe = w.attribList.length; he < pe; he++) {
            var _e = w.attribList[he], Ee = _e[0], He = _e[1], Ae = V(Ee, !0), $e = Ae.prefix, lt = Ae.local, nt = $e === "" ? "" : H.ns[$e] || "", tt = {
              name: Ee,
              value: He,
              prefix: $e,
              local: lt,
              uri: nt
            };
            $e && $e !== "xmlns" && !nt && (D(
              w,
              "Unbound namespace prefix: " + JSON.stringify($e)
            ), tt.uri = $e), w.tag.attributes[Ee] = tt, x(w, "onattribute", tt);
          }
          w.attribList.length = 0;
        }
        w.tag.isSelfClosing = !!E, w.sawRoot = !0, w.tags.push(w.tag), x(w, "onopentag", w.tag), E || (!w.noscript && w.tagName.toLowerCase() === "script" ? w.state = v.SCRIPT : w.state = v.TEXT, w.tag = null, w.tagName = ""), w.attribName = w.attribValue = "", w.attribList.length = 0;
      }
      function ie(w) {
        if (!w.tagName) {
          D(w, "Weird empty close tag."), w.textNode += "</>", w.state = v.TEXT;
          return;
        }
        if (w.script) {
          if (w.tagName !== "script") {
            w.script += "</" + w.tagName + ">", w.tagName = "", w.state = v.SCRIPT;
            return;
          }
          x(w, "onscript", w.script), w.script = "";
        }
        var E = w.tags.length, H = w.tagName;
        w.strict || (H = H[w.looseCase]());
        for (var F = H; E--; ) {
          var ce = w.tags[E];
          if (ce.name !== F)
            D(w, "Unexpected close tag");
          else
            break;
        }
        if (E < 0) {
          D(w, "Unmatched closing tag: " + w.tagName), w.textNode += "</" + w.tagName + ">", w.state = v.TEXT;
          return;
        }
        w.tagName = H;
        for (var he = w.tags.length; he-- > E; ) {
          var pe = w.tag = w.tags.pop();
          w.tagName = w.tag.name, x(w, "onclosetag", w.tagName);
          var _e = {};
          for (var Ee in pe.ns)
            _e[Ee] = pe.ns[Ee];
          var He = w.tags[w.tags.length - 1] || w;
          w.opt.xmlns && pe.ns !== He.ns && Object.keys(pe.ns).forEach(function(Ae) {
            var $e = pe.ns[Ae];
            x(w, "onclosenamespace", { prefix: Ae, uri: $e });
          });
        }
        E === 0 && (w.closedRoot = !0), w.tagName = w.attribValue = w.attribName = "", w.attribList.length = 0, w.state = v.TEXT;
      }
      function we(w) {
        var E = w.entity, H = E.toLowerCase(), F, ce = "";
        return w.ENTITIES[E] ? w.ENTITIES[E] : w.ENTITIES[H] ? w.ENTITIES[H] : (E = H, E.charAt(0) === "#" && (E.charAt(1) === "x" ? (E = E.slice(2), F = parseInt(E, 16), ce = F.toString(16)) : (E = E.slice(1), F = parseInt(E, 10), ce = F.toString(10))), E = E.replace(/^0+/, ""), isNaN(F) || ce.toLowerCase() !== E || F < 0 || F > 1114111 ? (D(w, "Invalid character entity"), "&" + w.entity + ";") : String.fromCodePoint(F));
      }
      function ve(w, E) {
        E === "<" ? (w.state = v.OPEN_WAKA, w.startTagPosition = w.position) : O(E) || (D(w, "Non-whitespace before first tag."), w.textNode = E, w.state = v.TEXT);
      }
      function Q(w, E) {
        var H = "";
        return E < w.length && (H = w.charAt(E)), H;
      }
      function ge(w) {
        var E = this;
        if (this.error)
          throw this.error;
        if (E.closed)
          return N(
            E,
            "Cannot write after close. Assign an onready handler."
          );
        if (w === null)
          return j(E);
        typeof w == "object" && (w = w.toString());
        for (var H = 0, F = ""; F = Q(w, H++), E.c = F, !!F; )
          switch (E.trackPosition && (E.position++, F === `
` ? (E.line++, E.column = 0) : E.column++), E.state) {
            case v.BEGIN:
              if (E.state = v.BEGIN_WHITESPACE, F === "\uFEFF")
                continue;
              ve(E, F);
              continue;
            case v.BEGIN_WHITESPACE:
              ve(E, F);
              continue;
            case v.TEXT:
              if (E.sawRoot && !E.closedRoot) {
                for (var he = H - 1; F && F !== "<" && F !== "&"; )
                  F = Q(w, H++), F && E.trackPosition && (E.position++, F === `
` ? (E.line++, E.column = 0) : E.column++);
                E.textNode += w.substring(he, H - 1);
              }
              F === "<" && !(E.sawRoot && E.closedRoot && !E.strict) ? (E.state = v.OPEN_WAKA, E.startTagPosition = E.position) : (!O(F) && (!E.sawRoot || E.closedRoot) && D(E, "Text data outside of root node."), F === "&" ? E.state = v.TEXT_ENTITY : E.textNode += F);
              continue;
            case v.SCRIPT:
              F === "<" ? E.state = v.SCRIPT_ENDING : E.script += F;
              continue;
            case v.SCRIPT_ENDING:
              F === "/" ? E.state = v.CLOSE_TAG : (E.script += "<" + F, E.state = v.SCRIPT);
              continue;
            case v.OPEN_WAKA:
              if (F === "!")
                E.state = v.SGML_DECL, E.sgmlDecl = "";
              else if (!O(F)) if (S(m, F))
                E.state = v.OPEN_TAG, E.tagName = F;
              else if (F === "/")
                E.state = v.CLOSE_TAG, E.tagName = "";
              else if (F === "?")
                E.state = v.PROC_INST, E.procInstName = E.procInstBody = "";
              else {
                if (D(E, "Unencoded <"), E.startTagPosition + 1 < E.position) {
                  var ce = E.position - E.startTagPosition;
                  F = new Array(ce).join(" ") + F;
                }
                E.textNode += "<" + F, E.state = v.TEXT;
              }
              continue;
            case v.SGML_DECL:
              if (E.sgmlDecl + F === "--") {
                E.state = v.COMMENT, E.comment = "", E.sgmlDecl = "";
                continue;
              }
              E.doctype && E.doctype !== !0 && E.sgmlDecl ? (E.state = v.DOCTYPE_DTD, E.doctype += "<!" + E.sgmlDecl + F, E.sgmlDecl = "") : (E.sgmlDecl + F).toUpperCase() === r ? (x(E, "onopencdata"), E.state = v.CDATA, E.sgmlDecl = "", E.cdata = "") : (E.sgmlDecl + F).toUpperCase() === n ? (E.state = v.DOCTYPE, (E.doctype || E.sawRoot) && D(
                E,
                "Inappropriately located doctype declaration"
              ), E.doctype = "", E.sgmlDecl = "") : F === ">" ? (x(E, "onsgmldeclaration", E.sgmlDecl), E.sgmlDecl = "", E.state = v.TEXT) : (b(F) && (E.state = v.SGML_DECL_QUOTED), E.sgmlDecl += F);
              continue;
            case v.SGML_DECL_QUOTED:
              F === E.q && (E.state = v.SGML_DECL, E.q = ""), E.sgmlDecl += F;
              continue;
            case v.DOCTYPE:
              F === ">" ? (E.state = v.TEXT, x(E, "ondoctype", E.doctype), E.doctype = !0) : (E.doctype += F, F === "[" ? E.state = v.DOCTYPE_DTD : b(F) && (E.state = v.DOCTYPE_QUOTED, E.q = F));
              continue;
            case v.DOCTYPE_QUOTED:
              E.doctype += F, F === E.q && (E.q = "", E.state = v.DOCTYPE);
              continue;
            case v.DOCTYPE_DTD:
              F === "]" ? (E.doctype += F, E.state = v.DOCTYPE) : F === "<" ? (E.state = v.OPEN_WAKA, E.startTagPosition = E.position) : b(F) ? (E.doctype += F, E.state = v.DOCTYPE_DTD_QUOTED, E.q = F) : E.doctype += F;
              continue;
            case v.DOCTYPE_DTD_QUOTED:
              E.doctype += F, F === E.q && (E.state = v.DOCTYPE_DTD, E.q = "");
              continue;
            case v.COMMENT:
              F === "-" ? E.state = v.COMMENT_ENDING : E.comment += F;
              continue;
            case v.COMMENT_ENDING:
              F === "-" ? (E.state = v.COMMENT_ENDED, E.comment = L(E.opt, E.comment), E.comment && x(E, "oncomment", E.comment), E.comment = "") : (E.comment += "-" + F, E.state = v.COMMENT);
              continue;
            case v.COMMENT_ENDED:
              F !== ">" ? (D(E, "Malformed comment"), E.comment += "--" + F, E.state = v.COMMENT) : E.doctype && E.doctype !== !0 ? E.state = v.DOCTYPE_DTD : E.state = v.TEXT;
              continue;
            case v.CDATA:
              for (var he = H - 1; F && F !== "]"; )
                F = Q(w, H++), F && E.trackPosition && (E.position++, F === `
` ? (E.line++, E.column = 0) : E.column++);
              E.cdata += w.substring(he, H - 1), F === "]" && (E.state = v.CDATA_ENDING);
              continue;
            case v.CDATA_ENDING:
              F === "]" ? E.state = v.CDATA_ENDING_2 : (E.cdata += "]" + F, E.state = v.CDATA);
              continue;
            case v.CDATA_ENDING_2:
              F === ">" ? (E.cdata && x(E, "oncdata", E.cdata), x(E, "onclosecdata"), E.cdata = "", E.state = v.TEXT) : F === "]" ? E.cdata += "]" : (E.cdata += "]]" + F, E.state = v.CDATA);
              continue;
            case v.PROC_INST:
              F === "?" ? E.state = v.PROC_INST_ENDING : O(F) ? E.state = v.PROC_INST_BODY : E.procInstName += F;
              continue;
            case v.PROC_INST_BODY:
              if (!E.procInstBody && O(F))
                continue;
              F === "?" ? E.state = v.PROC_INST_ENDING : E.procInstBody += F;
              continue;
            case v.PROC_INST_ENDING:
              F === ">" ? (x(E, "onprocessinginstruction", {
                name: E.procInstName,
                body: E.procInstBody
              }), E.procInstName = E.procInstBody = "", E.state = v.TEXT) : (E.procInstBody += "?" + F, E.state = v.PROC_INST_BODY);
              continue;
            case v.OPEN_TAG:
              S(_, F) ? E.tagName += F : (G(E), F === ">" ? de(E) : F === "/" ? E.state = v.OPEN_TAG_SLASH : (O(F) || D(E, "Invalid character in tag name"), E.state = v.ATTRIB));
              continue;
            case v.OPEN_TAG_SLASH:
              F === ">" ? (de(E, !0), ie(E)) : (D(
                E,
                "Forward-slash in opening tag not followed by >"
              ), E.state = v.ATTRIB);
              continue;
            case v.ATTRIB:
              if (O(F))
                continue;
              F === ">" ? de(E) : F === "/" ? E.state = v.OPEN_TAG_SLASH : S(m, F) ? (E.attribName = F, E.attribValue = "", E.state = v.ATTRIB_NAME) : D(E, "Invalid attribute name");
              continue;
            case v.ATTRIB_NAME:
              F === "=" ? E.state = v.ATTRIB_VALUE : F === ">" ? (D(E, "Attribute without value"), E.attribValue = E.attribName, te(E), de(E)) : O(F) ? E.state = v.ATTRIB_NAME_SAW_WHITE : S(_, F) ? E.attribName += F : D(E, "Invalid attribute name");
              continue;
            case v.ATTRIB_NAME_SAW_WHITE:
              if (F === "=")
                E.state = v.ATTRIB_VALUE;
              else {
                if (O(F))
                  continue;
                D(E, "Attribute without value"), E.tag.attributes[E.attribName] = "", E.attribValue = "", x(E, "onattribute", {
                  name: E.attribName,
                  value: ""
                }), E.attribName = "", F === ">" ? de(E) : S(m, F) ? (E.attribName = F, E.state = v.ATTRIB_NAME) : (D(E, "Invalid attribute name"), E.state = v.ATTRIB);
              }
              continue;
            case v.ATTRIB_VALUE:
              if (O(F))
                continue;
              b(F) ? (E.q = F, E.state = v.ATTRIB_VALUE_QUOTED) : (E.opt.unquotedAttributeValues || N(E, "Unquoted attribute value"), E.state = v.ATTRIB_VALUE_UNQUOTED, E.attribValue = F);
              continue;
            case v.ATTRIB_VALUE_QUOTED:
              if (F !== E.q) {
                F === "&" ? E.state = v.ATTRIB_VALUE_ENTITY_Q : E.attribValue += F;
                continue;
              }
              te(E), E.q = "", E.state = v.ATTRIB_VALUE_CLOSED;
              continue;
            case v.ATTRIB_VALUE_CLOSED:
              O(F) ? E.state = v.ATTRIB : F === ">" ? de(E) : F === "/" ? E.state = v.OPEN_TAG_SLASH : S(m, F) ? (D(E, "No whitespace between attributes"), E.attribName = F, E.attribValue = "", E.state = v.ATTRIB_NAME) : D(E, "Invalid attribute name");
              continue;
            case v.ATTRIB_VALUE_UNQUOTED:
              if (!I(F)) {
                F === "&" ? E.state = v.ATTRIB_VALUE_ENTITY_U : E.attribValue += F;
                continue;
              }
              te(E), F === ">" ? de(E) : E.state = v.ATTRIB;
              continue;
            case v.CLOSE_TAG:
              if (E.tagName)
                F === ">" ? ie(E) : S(_, F) ? E.tagName += F : E.script ? (E.script += "</" + E.tagName + F, E.tagName = "", E.state = v.SCRIPT) : (O(F) || D(E, "Invalid tagname in closing tag"), E.state = v.CLOSE_TAG_SAW_WHITE);
              else {
                if (O(F))
                  continue;
                A(m, F) ? E.script ? (E.script += "</" + F, E.state = v.SCRIPT) : D(E, "Invalid tagname in closing tag.") : E.tagName = F;
              }
              continue;
            case v.CLOSE_TAG_SAW_WHITE:
              if (O(F))
                continue;
              F === ">" ? ie(E) : D(E, "Invalid characters in closing tag");
              continue;
            case v.TEXT_ENTITY:
            case v.ATTRIB_VALUE_ENTITY_Q:
            case v.ATTRIB_VALUE_ENTITY_U:
              var pe, _e;
              switch (E.state) {
                case v.TEXT_ENTITY:
                  pe = v.TEXT, _e = "textNode";
                  break;
                case v.ATTRIB_VALUE_ENTITY_Q:
                  pe = v.ATTRIB_VALUE_QUOTED, _e = "attribValue";
                  break;
                case v.ATTRIB_VALUE_ENTITY_U:
                  pe = v.ATTRIB_VALUE_UNQUOTED, _e = "attribValue";
                  break;
              }
              if (F === ";") {
                var Ee = we(E);
                E.opt.unparsedEntities && !Object.values(d.XML_ENTITIES).includes(Ee) ? (E.entity = "", E.state = pe, E.write(Ee)) : (E[_e] += Ee, E.entity = "", E.state = pe);
              } else S(E.entity.length ? P : T, F) ? E.entity += F : (D(E, "Invalid character in entity name"), E[_e] += "&" + E.entity + F, E.entity = "", E.state = pe);
              continue;
            default:
              throw new Error(E, "Unknown state: " + E.state);
          }
        return E.position >= E.bufferCheckPosition && f(E), E;
      }
      String.fromCodePoint || (function() {
        var w = String.fromCharCode, E = Math.floor, H = function() {
          var F = 16384, ce = [], he, pe, _e = -1, Ee = arguments.length;
          if (!Ee)
            return "";
          for (var He = ""; ++_e < Ee; ) {
            var Ae = Number(arguments[_e]);
            if (!isFinite(Ae) || // `NaN`, `+Infinity`, or `-Infinity`
            Ae < 0 || // not a valid Unicode code point
            Ae > 1114111 || // not a valid Unicode code point
            E(Ae) !== Ae)
              throw RangeError("Invalid code point: " + Ae);
            Ae <= 65535 ? ce.push(Ae) : (Ae -= 65536, he = (Ae >> 10) + 55296, pe = Ae % 1024 + 56320, ce.push(he, pe)), (_e + 1 === Ee || ce.length > F) && (He += w.apply(null, ce), ce.length = 0);
          }
          return He;
        };
        Object.defineProperty ? Object.defineProperty(String, "fromCodePoint", {
          value: H,
          configurable: !0,
          writable: !0
        }) : String.fromCodePoint = H;
      })();
    })(t);
  })(Bn)), Bn;
}
var Do;
function df() {
  if (Do) return xt;
  Do = 1, Object.defineProperty(xt, "__esModule", { value: !0 }), xt.XElement = void 0, xt.parseXml = a;
  const t = ff(), d = Yr();
  class p {
    constructor(o) {
      if (this.name = o, this.value = "", this.attributes = null, this.isCData = !1, this.elements = null, !o)
        throw (0, d.newError)("Element name cannot be empty", "ERR_XML_ELEMENT_NAME_EMPTY");
      if (!f(o))
        throw (0, d.newError)(`Invalid element name: ${o}`, "ERR_XML_ELEMENT_INVALID_NAME");
    }
    attribute(o) {
      const s = this.attributes === null ? null : this.attributes[o];
      if (s == null)
        throw (0, d.newError)(`No attribute "${o}"`, "ERR_XML_MISSED_ATTRIBUTE");
      return s;
    }
    removeAttribute(o) {
      this.attributes !== null && delete this.attributes[o];
    }
    element(o, s = !1, i = null) {
      const r = this.elementOrNull(o, s);
      if (r === null)
        throw (0, d.newError)(i || `No element "${o}"`, "ERR_XML_MISSED_ELEMENT");
      return r;
    }
    elementOrNull(o, s = !1) {
      if (this.elements === null)
        return null;
      for (const i of this.elements)
        if (u(i, o, s))
          return i;
      return null;
    }
    getElements(o, s = !1) {
      return this.elements === null ? [] : this.elements.filter((i) => u(i, o, s));
    }
    elementValueOrEmpty(o, s = !1) {
      const i = this.elementOrNull(o, s);
      return i === null ? "" : i.value;
    }
  }
  xt.XElement = p;
  const c = new RegExp(/^[A-Za-z_][:A-Za-z0-9_-]*$/i);
  function f(l) {
    return c.test(l);
  }
  function u(l, o, s) {
    const i = l.name;
    return i === o || s === !0 && i.length === o.length && i.toLowerCase() === o.toLowerCase();
  }
  function a(l) {
    let o = null;
    const s = t.parser(!0, {}), i = [];
    return s.onopentag = (r) => {
      const n = new p(r.name);
      if (n.attributes = r.attributes, o === null)
        o = n;
      else {
        const h = i[i.length - 1];
        h.elements == null && (h.elements = []), h.elements.push(n);
      }
      i.push(n);
    }, s.onclosetag = () => {
      i.pop();
    }, s.ontext = (r) => {
      i.length > 0 && (i[i.length - 1].value = r);
    }, s.oncdata = (r) => {
      const n = i[i.length - 1];
      n.value = r, n.isCData = !0;
    }, s.onerror = (r) => {
      throw r;
    }, s.write(l), o;
  }
  return xt;
}
var No;
function Le() {
  return No || (No = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.CURRENT_APP_PACKAGE_FILE_NAME = t.CURRENT_APP_INSTALLER_FILE_NAME = t.XElement = t.parseXml = t.UUID = t.parseDn = t.retry = t.githubTagPrefix = t.githubUrl = t.getS3LikeProviderBaseUrl = t.ProgressCallbackTransform = t.MemoLazy = t.safeStringifyJson = t.safeGetHeader = t.parseJson = t.HttpExecutor = t.HttpError = t.DigestTransform = t.createHttpError = t.configureRequestUrl = t.configureRequestOptionsFromUrl = t.configureRequestOptions = t.newError = t.CancellationToken = t.CancellationError = void 0, t.asArray = r;
    var d = la();
    Object.defineProperty(t, "CancellationError", { enumerable: !0, get: function() {
      return d.CancellationError;
    } }), Object.defineProperty(t, "CancellationToken", { enumerable: !0, get: function() {
      return d.CancellationToken;
    } });
    var p = Yr();
    Object.defineProperty(t, "newError", { enumerable: !0, get: function() {
      return p.newError;
    } });
    var c = af();
    Object.defineProperty(t, "configureRequestOptions", { enumerable: !0, get: function() {
      return c.configureRequestOptions;
    } }), Object.defineProperty(t, "configureRequestOptionsFromUrl", { enumerable: !0, get: function() {
      return c.configureRequestOptionsFromUrl;
    } }), Object.defineProperty(t, "configureRequestUrl", { enumerable: !0, get: function() {
      return c.configureRequestUrl;
    } }), Object.defineProperty(t, "createHttpError", { enumerable: !0, get: function() {
      return c.createHttpError;
    } }), Object.defineProperty(t, "DigestTransform", { enumerable: !0, get: function() {
      return c.DigestTransform;
    } }), Object.defineProperty(t, "HttpError", { enumerable: !0, get: function() {
      return c.HttpError;
    } }), Object.defineProperty(t, "HttpExecutor", { enumerable: !0, get: function() {
      return c.HttpExecutor;
    } }), Object.defineProperty(t, "parseJson", { enumerable: !0, get: function() {
      return c.parseJson;
    } }), Object.defineProperty(t, "safeGetHeader", { enumerable: !0, get: function() {
      return c.safeGetHeader;
    } }), Object.defineProperty(t, "safeStringifyJson", { enumerable: !0, get: function() {
      return c.safeStringifyJson;
    } });
    var f = of();
    Object.defineProperty(t, "MemoLazy", { enumerable: !0, get: function() {
      return f.MemoLazy;
    } });
    var u = jl();
    Object.defineProperty(t, "ProgressCallbackTransform", { enumerable: !0, get: function() {
      return u.ProgressCallbackTransform;
    } });
    var a = sf();
    Object.defineProperty(t, "getS3LikeProviderBaseUrl", { enumerable: !0, get: function() {
      return a.getS3LikeProviderBaseUrl;
    } }), Object.defineProperty(t, "githubUrl", { enumerable: !0, get: function() {
      return a.githubUrl;
    } }), Object.defineProperty(t, "githubTagPrefix", { enumerable: !0, get: function() {
      return a.githubTagPrefix;
    } });
    var l = lf();
    Object.defineProperty(t, "retry", { enumerable: !0, get: function() {
      return l.retry;
    } });
    var o = uf();
    Object.defineProperty(t, "parseDn", { enumerable: !0, get: function() {
      return o.parseDn;
    } });
    var s = cf();
    Object.defineProperty(t, "UUID", { enumerable: !0, get: function() {
      return s.UUID;
    } });
    var i = df();
    Object.defineProperty(t, "parseXml", { enumerable: !0, get: function() {
      return i.parseXml;
    } }), Object.defineProperty(t, "XElement", { enumerable: !0, get: function() {
      return i.XElement;
    } }), t.CURRENT_APP_INSTALLER_FILE_NAME = "installer.exe", t.CURRENT_APP_PACKAGE_FILE_NAME = "package.7z";
    function r(n) {
      return n == null ? [] : Array.isArray(n) ? n : [n];
    }
  })(Un)), Un;
}
var qe = {}, kr = {}, dt = {}, Fo;
function yr() {
  if (Fo) return dt;
  Fo = 1;
  function t(a) {
    return typeof a > "u" || a === null;
  }
  function d(a) {
    return typeof a == "object" && a !== null;
  }
  function p(a) {
    return Array.isArray(a) ? a : t(a) ? [] : [a];
  }
  function c(a, l) {
    var o, s, i, r;
    if (l)
      for (r = Object.keys(l), o = 0, s = r.length; o < s; o += 1)
        i = r[o], a[i] = l[i];
    return a;
  }
  function f(a, l) {
    var o = "", s;
    for (s = 0; s < l; s += 1)
      o += a;
    return o;
  }
  function u(a) {
    return a === 0 && Number.NEGATIVE_INFINITY === 1 / a;
  }
  return dt.isNothing = t, dt.isObject = d, dt.toArray = p, dt.repeat = f, dt.isNegativeZero = u, dt.extend = c, dt;
}
var Hn, Lo;
function wr() {
  if (Lo) return Hn;
  Lo = 1;
  function t(p, c) {
    var f = "", u = p.reason || "(unknown reason)";
    return p.mark ? (p.mark.name && (f += 'in "' + p.mark.name + '" '), f += "(" + (p.mark.line + 1) + ":" + (p.mark.column + 1) + ")", !c && p.mark.snippet && (f += `

` + p.mark.snippet), u + " " + f) : u;
  }
  function d(p, c) {
    Error.call(this), this.name = "YAMLException", this.reason = p, this.mark = c, this.message = t(this, !1), Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : this.stack = new Error().stack || "";
  }
  return d.prototype = Object.create(Error.prototype), d.prototype.constructor = d, d.prototype.toString = function(c) {
    return this.name + ": " + t(this, c);
  }, Hn = d, Hn;
}
var jn, xo;
function hf() {
  if (xo) return jn;
  xo = 1;
  var t = yr();
  function d(f, u, a, l, o) {
    var s = "", i = "", r = Math.floor(o / 2) - 1;
    return l - u > r && (s = " ... ", u = l - r + s.length), a - l > r && (i = " ...", a = l + r - i.length), {
      str: s + f.slice(u, a).replace(/\t/g, "→") + i,
      pos: l - u + s.length
      // relative position
    };
  }
  function p(f, u) {
    return t.repeat(" ", u - f.length) + f;
  }
  function c(f, u) {
    if (u = Object.create(u || null), !f.buffer) return null;
    u.maxLength || (u.maxLength = 79), typeof u.indent != "number" && (u.indent = 1), typeof u.linesBefore != "number" && (u.linesBefore = 3), typeof u.linesAfter != "number" && (u.linesAfter = 2);
    for (var a = /\r?\n|\r|\0/g, l = [0], o = [], s, i = -1; s = a.exec(f.buffer); )
      o.push(s.index), l.push(s.index + s[0].length), f.position <= s.index && i < 0 && (i = l.length - 2);
    i < 0 && (i = l.length - 1);
    var r = "", n, h, g = Math.min(f.line + u.linesAfter, o.length).toString().length, y = u.maxLength - (u.indent + g + 3);
    for (n = 1; n <= u.linesBefore && !(i - n < 0); n++)
      h = d(
        f.buffer,
        l[i - n],
        o[i - n],
        f.position - (l[i] - l[i - n]),
        y
      ), r = t.repeat(" ", u.indent) + p((f.line - n + 1).toString(), g) + " | " + h.str + `
` + r;
    for (h = d(f.buffer, l[i], o[i], f.position, y), r += t.repeat(" ", u.indent) + p((f.line + 1).toString(), g) + " | " + h.str + `
`, r += t.repeat("-", u.indent + g + 3 + h.pos) + `^
`, n = 1; n <= u.linesAfter && !(i + n >= o.length); n++)
      h = d(
        f.buffer,
        l[i + n],
        o[i + n],
        f.position - (l[i] - l[i + n]),
        y
      ), r += t.repeat(" ", u.indent) + p((f.line + n + 1).toString(), g) + " | " + h.str + `
`;
    return r.replace(/\n$/, "");
  }
  return jn = c, jn;
}
var Gn, Uo;
function Me() {
  if (Uo) return Gn;
  Uo = 1;
  var t = wr(), d = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ], p = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function c(u) {
    var a = {};
    return u !== null && Object.keys(u).forEach(function(l) {
      u[l].forEach(function(o) {
        a[String(o)] = l;
      });
    }), a;
  }
  function f(u, a) {
    if (a = a || {}, Object.keys(a).forEach(function(l) {
      if (d.indexOf(l) === -1)
        throw new t('Unknown option "' + l + '" is met in definition of "' + u + '" YAML type.');
    }), this.options = a, this.tag = u, this.kind = a.kind || null, this.resolve = a.resolve || function() {
      return !0;
    }, this.construct = a.construct || function(l) {
      return l;
    }, this.instanceOf = a.instanceOf || null, this.predicate = a.predicate || null, this.represent = a.represent || null, this.representName = a.representName || null, this.defaultStyle = a.defaultStyle || null, this.multi = a.multi || !1, this.styleAliases = c(a.styleAliases || null), p.indexOf(this.kind) === -1)
      throw new t('Unknown kind "' + this.kind + '" is specified for "' + u + '" YAML type.');
  }
  return Gn = f, Gn;
}
var Wn, ko;
function Gl() {
  if (ko) return Wn;
  ko = 1;
  var t = wr(), d = Me();
  function p(u, a) {
    var l = [];
    return u[a].forEach(function(o) {
      var s = l.length;
      l.forEach(function(i, r) {
        i.tag === o.tag && i.kind === o.kind && i.multi === o.multi && (s = r);
      }), l[s] = o;
    }), l;
  }
  function c() {
    var u = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    }, a, l;
    function o(s) {
      s.multi ? (u.multi[s.kind].push(s), u.multi.fallback.push(s)) : u[s.kind][s.tag] = u.fallback[s.tag] = s;
    }
    for (a = 0, l = arguments.length; a < l; a += 1)
      arguments[a].forEach(o);
    return u;
  }
  function f(u) {
    return this.extend(u);
  }
  return f.prototype.extend = function(a) {
    var l = [], o = [];
    if (a instanceof d)
      o.push(a);
    else if (Array.isArray(a))
      o = o.concat(a);
    else if (a && (Array.isArray(a.implicit) || Array.isArray(a.explicit)))
      a.implicit && (l = l.concat(a.implicit)), a.explicit && (o = o.concat(a.explicit));
    else
      throw new t("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    l.forEach(function(i) {
      if (!(i instanceof d))
        throw new t("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      if (i.loadKind && i.loadKind !== "scalar")
        throw new t("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      if (i.multi)
        throw new t("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }), o.forEach(function(i) {
      if (!(i instanceof d))
        throw new t("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    });
    var s = Object.create(f.prototype);
    return s.implicit = (this.implicit || []).concat(l), s.explicit = (this.explicit || []).concat(o), s.compiledImplicit = p(s, "implicit"), s.compiledExplicit = p(s, "explicit"), s.compiledTypeMap = c(s.compiledImplicit, s.compiledExplicit), s;
  }, Wn = f, Wn;
}
var Vn, qo;
function Wl() {
  if (qo) return Vn;
  qo = 1;
  var t = Me();
  return Vn = new t("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(d) {
      return d !== null ? d : "";
    }
  }), Vn;
}
var Yn, $o;
function Vl() {
  if ($o) return Yn;
  $o = 1;
  var t = Me();
  return Yn = new t("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(d) {
      return d !== null ? d : [];
    }
  }), Yn;
}
var zn, Mo;
function Yl() {
  if (Mo) return zn;
  Mo = 1;
  var t = Me();
  return zn = new t("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(d) {
      return d !== null ? d : {};
    }
  }), zn;
}
var Xn, Bo;
function zl() {
  if (Bo) return Xn;
  Bo = 1;
  var t = Gl();
  return Xn = new t({
    explicit: [
      Wl(),
      Vl(),
      Yl()
    ]
  }), Xn;
}
var Kn, Ho;
function Xl() {
  if (Ho) return Kn;
  Ho = 1;
  var t = Me();
  function d(f) {
    if (f === null) return !0;
    var u = f.length;
    return u === 1 && f === "~" || u === 4 && (f === "null" || f === "Null" || f === "NULL");
  }
  function p() {
    return null;
  }
  function c(f) {
    return f === null;
  }
  return Kn = new t("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: d,
    construct: p,
    predicate: c,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  }), Kn;
}
var Jn, jo;
function Kl() {
  if (jo) return Jn;
  jo = 1;
  var t = Me();
  function d(f) {
    if (f === null) return !1;
    var u = f.length;
    return u === 4 && (f === "true" || f === "True" || f === "TRUE") || u === 5 && (f === "false" || f === "False" || f === "FALSE");
  }
  function p(f) {
    return f === "true" || f === "True" || f === "TRUE";
  }
  function c(f) {
    return Object.prototype.toString.call(f) === "[object Boolean]";
  }
  return Jn = new t("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: d,
    construct: p,
    predicate: c,
    represent: {
      lowercase: function(f) {
        return f ? "true" : "false";
      },
      uppercase: function(f) {
        return f ? "TRUE" : "FALSE";
      },
      camelcase: function(f) {
        return f ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  }), Jn;
}
var Qn, Go;
function Jl() {
  if (Go) return Qn;
  Go = 1;
  var t = yr(), d = Me();
  function p(o) {
    return 48 <= o && o <= 57 || 65 <= o && o <= 70 || 97 <= o && o <= 102;
  }
  function c(o) {
    return 48 <= o && o <= 55;
  }
  function f(o) {
    return 48 <= o && o <= 57;
  }
  function u(o) {
    if (o === null) return !1;
    var s = o.length, i = 0, r = !1, n;
    if (!s) return !1;
    if (n = o[i], (n === "-" || n === "+") && (n = o[++i]), n === "0") {
      if (i + 1 === s) return !0;
      if (n = o[++i], n === "b") {
        for (i++; i < s; i++)
          if (n = o[i], n !== "_") {
            if (n !== "0" && n !== "1") return !1;
            r = !0;
          }
        return r && n !== "_";
      }
      if (n === "x") {
        for (i++; i < s; i++)
          if (n = o[i], n !== "_") {
            if (!p(o.charCodeAt(i))) return !1;
            r = !0;
          }
        return r && n !== "_";
      }
      if (n === "o") {
        for (i++; i < s; i++)
          if (n = o[i], n !== "_") {
            if (!c(o.charCodeAt(i))) return !1;
            r = !0;
          }
        return r && n !== "_";
      }
    }
    if (n === "_") return !1;
    for (; i < s; i++)
      if (n = o[i], n !== "_") {
        if (!f(o.charCodeAt(i)))
          return !1;
        r = !0;
      }
    return !(!r || n === "_");
  }
  function a(o) {
    var s = o, i = 1, r;
    if (s.indexOf("_") !== -1 && (s = s.replace(/_/g, "")), r = s[0], (r === "-" || r === "+") && (r === "-" && (i = -1), s = s.slice(1), r = s[0]), s === "0") return 0;
    if (r === "0") {
      if (s[1] === "b") return i * parseInt(s.slice(2), 2);
      if (s[1] === "x") return i * parseInt(s.slice(2), 16);
      if (s[1] === "o") return i * parseInt(s.slice(2), 8);
    }
    return i * parseInt(s, 10);
  }
  function l(o) {
    return Object.prototype.toString.call(o) === "[object Number]" && o % 1 === 0 && !t.isNegativeZero(o);
  }
  return Qn = new d("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: u,
    construct: a,
    predicate: l,
    represent: {
      binary: function(o) {
        return o >= 0 ? "0b" + o.toString(2) : "-0b" + o.toString(2).slice(1);
      },
      octal: function(o) {
        return o >= 0 ? "0o" + o.toString(8) : "-0o" + o.toString(8).slice(1);
      },
      decimal: function(o) {
        return o.toString(10);
      },
      /* eslint-disable max-len */
      hexadecimal: function(o) {
        return o >= 0 ? "0x" + o.toString(16).toUpperCase() : "-0x" + o.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  }), Qn;
}
var Zn, Wo;
function Ql() {
  if (Wo) return Zn;
  Wo = 1;
  var t = yr(), d = Me(), p = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function c(o) {
    return !(o === null || !p.test(o) || // Quick hack to not allow integers end with `_`
    // Probably should update regexp & check speed
    o[o.length - 1] === "_");
  }
  function f(o) {
    var s, i;
    return s = o.replace(/_/g, "").toLowerCase(), i = s[0] === "-" ? -1 : 1, "+-".indexOf(s[0]) >= 0 && (s = s.slice(1)), s === ".inf" ? i === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY : s === ".nan" ? NaN : i * parseFloat(s, 10);
  }
  var u = /^[-+]?[0-9]+e/;
  function a(o, s) {
    var i;
    if (isNaN(o))
      switch (s) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    else if (Number.POSITIVE_INFINITY === o)
      switch (s) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    else if (Number.NEGATIVE_INFINITY === o)
      switch (s) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    else if (t.isNegativeZero(o))
      return "-0.0";
    return i = o.toString(10), u.test(i) ? i.replace("e", ".e") : i;
  }
  function l(o) {
    return Object.prototype.toString.call(o) === "[object Number]" && (o % 1 !== 0 || t.isNegativeZero(o));
  }
  return Zn = new d("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: c,
    construct: f,
    predicate: l,
    represent: a,
    defaultStyle: "lowercase"
  }), Zn;
}
var ei, Vo;
function Zl() {
  return Vo || (Vo = 1, ei = zl().extend({
    implicit: [
      Xl(),
      Kl(),
      Jl(),
      Ql()
    ]
  })), ei;
}
var ti, Yo;
function eu() {
  return Yo || (Yo = 1, ti = Zl()), ti;
}
var ri, zo;
function tu() {
  if (zo) return ri;
  zo = 1;
  var t = Me(), d = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  ), p = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function c(a) {
    return a === null ? !1 : d.exec(a) !== null || p.exec(a) !== null;
  }
  function f(a) {
    var l, o, s, i, r, n, h, g = 0, y = null, m, _, T;
    if (l = d.exec(a), l === null && (l = p.exec(a)), l === null) throw new Error("Date resolve error");
    if (o = +l[1], s = +l[2] - 1, i = +l[3], !l[4])
      return new Date(Date.UTC(o, s, i));
    if (r = +l[4], n = +l[5], h = +l[6], l[7]) {
      for (g = l[7].slice(0, 3); g.length < 3; )
        g += "0";
      g = +g;
    }
    return l[9] && (m = +l[10], _ = +(l[11] || 0), y = (m * 60 + _) * 6e4, l[9] === "-" && (y = -y)), T = new Date(Date.UTC(o, s, i, r, n, h, g)), y && T.setTime(T.getTime() - y), T;
  }
  function u(a) {
    return a.toISOString();
  }
  return ri = new t("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: c,
    construct: f,
    instanceOf: Date,
    represent: u
  }), ri;
}
var ni, Xo;
function ru() {
  if (Xo) return ni;
  Xo = 1;
  var t = Me();
  function d(p) {
    return p === "<<" || p === null;
  }
  return ni = new t("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: d
  }), ni;
}
var ii, Ko;
function nu() {
  if (Ko) return ii;
  Ko = 1;
  var t = Me(), d = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;
  function p(a) {
    if (a === null) return !1;
    var l, o, s = 0, i = a.length, r = d;
    for (o = 0; o < i; o++)
      if (l = r.indexOf(a.charAt(o)), !(l > 64)) {
        if (l < 0) return !1;
        s += 6;
      }
    return s % 8 === 0;
  }
  function c(a) {
    var l, o, s = a.replace(/[\r\n=]/g, ""), i = s.length, r = d, n = 0, h = [];
    for (l = 0; l < i; l++)
      l % 4 === 0 && l && (h.push(n >> 16 & 255), h.push(n >> 8 & 255), h.push(n & 255)), n = n << 6 | r.indexOf(s.charAt(l));
    return o = i % 4 * 6, o === 0 ? (h.push(n >> 16 & 255), h.push(n >> 8 & 255), h.push(n & 255)) : o === 18 ? (h.push(n >> 10 & 255), h.push(n >> 2 & 255)) : o === 12 && h.push(n >> 4 & 255), new Uint8Array(h);
  }
  function f(a) {
    var l = "", o = 0, s, i, r = a.length, n = d;
    for (s = 0; s < r; s++)
      s % 3 === 0 && s && (l += n[o >> 18 & 63], l += n[o >> 12 & 63], l += n[o >> 6 & 63], l += n[o & 63]), o = (o << 8) + a[s];
    return i = r % 3, i === 0 ? (l += n[o >> 18 & 63], l += n[o >> 12 & 63], l += n[o >> 6 & 63], l += n[o & 63]) : i === 2 ? (l += n[o >> 10 & 63], l += n[o >> 4 & 63], l += n[o << 2 & 63], l += n[64]) : i === 1 && (l += n[o >> 2 & 63], l += n[o << 4 & 63], l += n[64], l += n[64]), l;
  }
  function u(a) {
    return Object.prototype.toString.call(a) === "[object Uint8Array]";
  }
  return ii = new t("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: p,
    construct: c,
    predicate: u,
    represent: f
  }), ii;
}
var ai, Jo;
function iu() {
  if (Jo) return ai;
  Jo = 1;
  var t = Me(), d = Object.prototype.hasOwnProperty, p = Object.prototype.toString;
  function c(u) {
    if (u === null) return !0;
    var a = [], l, o, s, i, r, n = u;
    for (l = 0, o = n.length; l < o; l += 1) {
      if (s = n[l], r = !1, p.call(s) !== "[object Object]") return !1;
      for (i in s)
        if (d.call(s, i))
          if (!r) r = !0;
          else return !1;
      if (!r) return !1;
      if (a.indexOf(i) === -1) a.push(i);
      else return !1;
    }
    return !0;
  }
  function f(u) {
    return u !== null ? u : [];
  }
  return ai = new t("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: c,
    construct: f
  }), ai;
}
var oi, Qo;
function au() {
  if (Qo) return oi;
  Qo = 1;
  var t = Me(), d = Object.prototype.toString;
  function p(f) {
    if (f === null) return !0;
    var u, a, l, o, s, i = f;
    for (s = new Array(i.length), u = 0, a = i.length; u < a; u += 1) {
      if (l = i[u], d.call(l) !== "[object Object]" || (o = Object.keys(l), o.length !== 1)) return !1;
      s[u] = [o[0], l[o[0]]];
    }
    return !0;
  }
  function c(f) {
    if (f === null) return [];
    var u, a, l, o, s, i = f;
    for (s = new Array(i.length), u = 0, a = i.length; u < a; u += 1)
      l = i[u], o = Object.keys(l), s[u] = [o[0], l[o[0]]];
    return s;
  }
  return oi = new t("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: p,
    construct: c
  }), oi;
}
var si, Zo;
function ou() {
  if (Zo) return si;
  Zo = 1;
  var t = Me(), d = Object.prototype.hasOwnProperty;
  function p(f) {
    if (f === null) return !0;
    var u, a = f;
    for (u in a)
      if (d.call(a, u) && a[u] !== null)
        return !1;
    return !0;
  }
  function c(f) {
    return f !== null ? f : {};
  }
  return si = new t("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: p,
    construct: c
  }), si;
}
var li, es;
function ua() {
  return es || (es = 1, li = eu().extend({
    implicit: [
      tu(),
      ru()
    ],
    explicit: [
      nu(),
      iu(),
      au(),
      ou()
    ]
  })), li;
}
var ts;
function pf() {
  if (ts) return kr;
  ts = 1;
  var t = yr(), d = wr(), p = hf(), c = ua(), f = Object.prototype.hasOwnProperty, u = 1, a = 2, l = 3, o = 4, s = 1, i = 2, r = 3, n = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/, h = /[\x85\u2028\u2029]/, g = /[,\[\]\{\}]/, y = /^(?:!|!!|![a-z\-]+!)$/i, m = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  function _(e) {
    return Object.prototype.toString.call(e);
  }
  function T(e) {
    return e === 10 || e === 13;
  }
  function P(e) {
    return e === 9 || e === 32;
  }
  function O(e) {
    return e === 9 || e === 32 || e === 10 || e === 13;
  }
  function b(e) {
    return e === 44 || e === 91 || e === 93 || e === 123 || e === 125;
  }
  function I(e) {
    var B;
    return 48 <= e && e <= 57 ? e - 48 : (B = e | 32, 97 <= B && B <= 102 ? B - 97 + 10 : -1);
  }
  function S(e) {
    return e === 120 ? 2 : e === 117 ? 4 : e === 85 ? 8 : 0;
  }
  function A(e) {
    return 48 <= e && e <= 57 ? e - 48 : -1;
  }
  function v(e) {
    return e === 48 ? "\0" : e === 97 ? "\x07" : e === 98 ? "\b" : e === 116 || e === 9 ? "	" : e === 110 ? `
` : e === 118 ? "\v" : e === 102 ? "\f" : e === 114 ? "\r" : e === 101 ? "\x1B" : e === 32 ? " " : e === 34 ? '"' : e === 47 ? "/" : e === 92 ? "\\" : e === 78 ? "" : e === 95 ? " " : e === 76 ? "\u2028" : e === 80 ? "\u2029" : "";
  }
  function k(e) {
    return e <= 65535 ? String.fromCharCode(e) : String.fromCharCode(
      (e - 65536 >> 10) + 55296,
      (e - 65536 & 1023) + 56320
    );
  }
  function q(e, B, W) {
    B === "__proto__" ? Object.defineProperty(e, B, {
      configurable: !0,
      enumerable: !0,
      writable: !0,
      value: W
    }) : e[B] = W;
  }
  for (var x = new Array(256), $ = new Array(256), L = 0; L < 256; L++)
    x[L] = v(L) ? 1 : 0, $[L] = v(L);
  function N(e, B) {
    this.input = e, this.filename = B.filename || null, this.schema = B.schema || c, this.onWarning = B.onWarning || null, this.legacy = B.legacy || !1, this.json = B.json || !1, this.listener = B.listener || null, this.implicitTypes = this.schema.compiledImplicit, this.typeMap = this.schema.compiledTypeMap, this.length = e.length, this.position = 0, this.line = 0, this.lineStart = 0, this.lineIndent = 0, this.firstTabInLine = -1, this.documents = [];
  }
  function j(e, B) {
    var W = {
      name: e.filename,
      buffer: e.input.slice(0, -1),
      // omit trailing \0
      position: e.position,
      line: e.line,
      column: e.position - e.lineStart
    };
    return W.snippet = p(W), new d(B, W);
  }
  function D(e, B) {
    throw j(e, B);
  }
  function G(e, B) {
    e.onWarning && e.onWarning.call(null, j(e, B));
  }
  var V = {
    YAML: function(B, W, ne) {
      var Y, re, Z;
      B.version !== null && D(B, "duplication of %YAML directive"), ne.length !== 1 && D(B, "YAML directive accepts exactly one argument"), Y = /^([0-9]+)\.([0-9]+)$/.exec(ne[0]), Y === null && D(B, "ill-formed argument of the YAML directive"), re = parseInt(Y[1], 10), Z = parseInt(Y[2], 10), re !== 1 && D(B, "unacceptable YAML version of the document"), B.version = ne[0], B.checkLineBreaks = Z < 2, Z !== 1 && Z !== 2 && G(B, "unsupported YAML version of the document");
    },
    TAG: function(B, W, ne) {
      var Y, re;
      ne.length !== 2 && D(B, "TAG directive accepts exactly two arguments"), Y = ne[0], re = ne[1], y.test(Y) || D(B, "ill-formed tag handle (first argument) of the TAG directive"), f.call(B.tagMap, Y) && D(B, 'there is a previously declared suffix for "' + Y + '" tag handle'), m.test(re) || D(B, "ill-formed tag prefix (second argument) of the TAG directive");
      try {
        re = decodeURIComponent(re);
      } catch {
        D(B, "tag prefix is malformed: " + re);
      }
      B.tagMap[Y] = re;
    }
  };
  function te(e, B, W, ne) {
    var Y, re, Z, oe;
    if (B < W) {
      if (oe = e.input.slice(B, W), ne)
        for (Y = 0, re = oe.length; Y < re; Y += 1)
          Z = oe.charCodeAt(Y), Z === 9 || 32 <= Z && Z <= 1114111 || D(e, "expected valid JSON character");
      else n.test(oe) && D(e, "the stream contains non-printable characters");
      e.result += oe;
    }
  }
  function de(e, B, W, ne) {
    var Y, re, Z, oe;
    for (t.isObject(W) || D(e, "cannot merge mappings; the provided source object is unacceptable"), Y = Object.keys(W), Z = 0, oe = Y.length; Z < oe; Z += 1)
      re = Y[Z], f.call(B, re) || (q(B, re, W[re]), ne[re] = !0);
  }
  function ie(e, B, W, ne, Y, re, Z, oe, ue) {
    var Te, Se;
    if (Array.isArray(Y))
      for (Y = Array.prototype.slice.call(Y), Te = 0, Se = Y.length; Te < Se; Te += 1)
        Array.isArray(Y[Te]) && D(e, "nested arrays are not supported inside keys"), typeof Y == "object" && _(Y[Te]) === "[object Object]" && (Y[Te] = "[object Object]");
    if (typeof Y == "object" && _(Y) === "[object Object]" && (Y = "[object Object]"), Y = String(Y), B === null && (B = {}), ne === "tag:yaml.org,2002:merge")
      if (Array.isArray(re))
        for (Te = 0, Se = re.length; Te < Se; Te += 1)
          de(e, B, re[Te], W);
      else
        de(e, B, re, W);
    else
      !e.json && !f.call(W, Y) && f.call(B, Y) && (e.line = Z || e.line, e.lineStart = oe || e.lineStart, e.position = ue || e.position, D(e, "duplicated mapping key")), q(B, Y, re), delete W[Y];
    return B;
  }
  function we(e) {
    var B;
    B = e.input.charCodeAt(e.position), B === 10 ? e.position++ : B === 13 ? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++) : D(e, "a line break is expected"), e.line += 1, e.lineStart = e.position, e.firstTabInLine = -1;
  }
  function ve(e, B, W) {
    for (var ne = 0, Y = e.input.charCodeAt(e.position); Y !== 0; ) {
      for (; P(Y); )
        Y === 9 && e.firstTabInLine === -1 && (e.firstTabInLine = e.position), Y = e.input.charCodeAt(++e.position);
      if (B && Y === 35)
        do
          Y = e.input.charCodeAt(++e.position);
        while (Y !== 10 && Y !== 13 && Y !== 0);
      if (T(Y))
        for (we(e), Y = e.input.charCodeAt(e.position), ne++, e.lineIndent = 0; Y === 32; )
          e.lineIndent++, Y = e.input.charCodeAt(++e.position);
      else
        break;
    }
    return W !== -1 && ne !== 0 && e.lineIndent < W && G(e, "deficient indentation"), ne;
  }
  function Q(e) {
    var B = e.position, W;
    return W = e.input.charCodeAt(B), !!((W === 45 || W === 46) && W === e.input.charCodeAt(B + 1) && W === e.input.charCodeAt(B + 2) && (B += 3, W = e.input.charCodeAt(B), W === 0 || O(W)));
  }
  function ge(e, B) {
    B === 1 ? e.result += " " : B > 1 && (e.result += t.repeat(`
`, B - 1));
  }
  function w(e, B, W) {
    var ne, Y, re, Z, oe, ue, Te, Se, me = e.kind, R = e.result, M;
    if (M = e.input.charCodeAt(e.position), O(M) || b(M) || M === 35 || M === 38 || M === 42 || M === 33 || M === 124 || M === 62 || M === 39 || M === 34 || M === 37 || M === 64 || M === 96 || (M === 63 || M === 45) && (Y = e.input.charCodeAt(e.position + 1), O(Y) || W && b(Y)))
      return !1;
    for (e.kind = "scalar", e.result = "", re = Z = e.position, oe = !1; M !== 0; ) {
      if (M === 58) {
        if (Y = e.input.charCodeAt(e.position + 1), O(Y) || W && b(Y))
          break;
      } else if (M === 35) {
        if (ne = e.input.charCodeAt(e.position - 1), O(ne))
          break;
      } else {
        if (e.position === e.lineStart && Q(e) || W && b(M))
          break;
        if (T(M))
          if (ue = e.line, Te = e.lineStart, Se = e.lineIndent, ve(e, !1, -1), e.lineIndent >= B) {
            oe = !0, M = e.input.charCodeAt(e.position);
            continue;
          } else {
            e.position = Z, e.line = ue, e.lineStart = Te, e.lineIndent = Se;
            break;
          }
      }
      oe && (te(e, re, Z, !1), ge(e, e.line - ue), re = Z = e.position, oe = !1), P(M) || (Z = e.position + 1), M = e.input.charCodeAt(++e.position);
    }
    return te(e, re, Z, !1), e.result ? !0 : (e.kind = me, e.result = R, !1);
  }
  function E(e, B) {
    var W, ne, Y;
    if (W = e.input.charCodeAt(e.position), W !== 39)
      return !1;
    for (e.kind = "scalar", e.result = "", e.position++, ne = Y = e.position; (W = e.input.charCodeAt(e.position)) !== 0; )
      if (W === 39)
        if (te(e, ne, e.position, !0), W = e.input.charCodeAt(++e.position), W === 39)
          ne = e.position, e.position++, Y = e.position;
        else
          return !0;
      else T(W) ? (te(e, ne, Y, !0), ge(e, ve(e, !1, B)), ne = Y = e.position) : e.position === e.lineStart && Q(e) ? D(e, "unexpected end of the document within a single quoted scalar") : (e.position++, Y = e.position);
    D(e, "unexpected end of the stream within a single quoted scalar");
  }
  function H(e, B) {
    var W, ne, Y, re, Z, oe;
    if (oe = e.input.charCodeAt(e.position), oe !== 34)
      return !1;
    for (e.kind = "scalar", e.result = "", e.position++, W = ne = e.position; (oe = e.input.charCodeAt(e.position)) !== 0; ) {
      if (oe === 34)
        return te(e, W, e.position, !0), e.position++, !0;
      if (oe === 92) {
        if (te(e, W, e.position, !0), oe = e.input.charCodeAt(++e.position), T(oe))
          ve(e, !1, B);
        else if (oe < 256 && x[oe])
          e.result += $[oe], e.position++;
        else if ((Z = S(oe)) > 0) {
          for (Y = Z, re = 0; Y > 0; Y--)
            oe = e.input.charCodeAt(++e.position), (Z = I(oe)) >= 0 ? re = (re << 4) + Z : D(e, "expected hexadecimal character");
          e.result += k(re), e.position++;
        } else
          D(e, "unknown escape sequence");
        W = ne = e.position;
      } else T(oe) ? (te(e, W, ne, !0), ge(e, ve(e, !1, B)), W = ne = e.position) : e.position === e.lineStart && Q(e) ? D(e, "unexpected end of the document within a double quoted scalar") : (e.position++, ne = e.position);
    }
    D(e, "unexpected end of the stream within a double quoted scalar");
  }
  function F(e, B) {
    var W = !0, ne, Y, re, Z = e.tag, oe, ue = e.anchor, Te, Se, me, R, M, z = /* @__PURE__ */ Object.create(null), X, K, ae, ee;
    if (ee = e.input.charCodeAt(e.position), ee === 91)
      Se = 93, M = !1, oe = [];
    else if (ee === 123)
      Se = 125, M = !0, oe = {};
    else
      return !1;
    for (e.anchor !== null && (e.anchorMap[e.anchor] = oe), ee = e.input.charCodeAt(++e.position); ee !== 0; ) {
      if (ve(e, !0, B), ee = e.input.charCodeAt(e.position), ee === Se)
        return e.position++, e.tag = Z, e.anchor = ue, e.kind = M ? "mapping" : "sequence", e.result = oe, !0;
      W ? ee === 44 && D(e, "expected the node content, but found ','") : D(e, "missed comma between flow collection entries"), K = X = ae = null, me = R = !1, ee === 63 && (Te = e.input.charCodeAt(e.position + 1), O(Te) && (me = R = !0, e.position++, ve(e, !0, B))), ne = e.line, Y = e.lineStart, re = e.position, Ae(e, B, u, !1, !0), K = e.tag, X = e.result, ve(e, !0, B), ee = e.input.charCodeAt(e.position), (R || e.line === ne) && ee === 58 && (me = !0, ee = e.input.charCodeAt(++e.position), ve(e, !0, B), Ae(e, B, u, !1, !0), ae = e.result), M ? ie(e, oe, z, K, X, ae, ne, Y, re) : me ? oe.push(ie(e, null, z, K, X, ae, ne, Y, re)) : oe.push(X), ve(e, !0, B), ee = e.input.charCodeAt(e.position), ee === 44 ? (W = !0, ee = e.input.charCodeAt(++e.position)) : W = !1;
    }
    D(e, "unexpected end of the stream within a flow collection");
  }
  function ce(e, B) {
    var W, ne, Y = s, re = !1, Z = !1, oe = B, ue = 0, Te = !1, Se, me;
    if (me = e.input.charCodeAt(e.position), me === 124)
      ne = !1;
    else if (me === 62)
      ne = !0;
    else
      return !1;
    for (e.kind = "scalar", e.result = ""; me !== 0; )
      if (me = e.input.charCodeAt(++e.position), me === 43 || me === 45)
        s === Y ? Y = me === 43 ? r : i : D(e, "repeat of a chomping mode identifier");
      else if ((Se = A(me)) >= 0)
        Se === 0 ? D(e, "bad explicit indentation width of a block scalar; it cannot be less than one") : Z ? D(e, "repeat of an indentation width identifier") : (oe = B + Se - 1, Z = !0);
      else
        break;
    if (P(me)) {
      do
        me = e.input.charCodeAt(++e.position);
      while (P(me));
      if (me === 35)
        do
          me = e.input.charCodeAt(++e.position);
        while (!T(me) && me !== 0);
    }
    for (; me !== 0; ) {
      for (we(e), e.lineIndent = 0, me = e.input.charCodeAt(e.position); (!Z || e.lineIndent < oe) && me === 32; )
        e.lineIndent++, me = e.input.charCodeAt(++e.position);
      if (!Z && e.lineIndent > oe && (oe = e.lineIndent), T(me)) {
        ue++;
        continue;
      }
      if (e.lineIndent < oe) {
        Y === r ? e.result += t.repeat(`
`, re ? 1 + ue : ue) : Y === s && re && (e.result += `
`);
        break;
      }
      for (ne ? P(me) ? (Te = !0, e.result += t.repeat(`
`, re ? 1 + ue : ue)) : Te ? (Te = !1, e.result += t.repeat(`
`, ue + 1)) : ue === 0 ? re && (e.result += " ") : e.result += t.repeat(`
`, ue) : e.result += t.repeat(`
`, re ? 1 + ue : ue), re = !0, Z = !0, ue = 0, W = e.position; !T(me) && me !== 0; )
        me = e.input.charCodeAt(++e.position);
      te(e, W, e.position, !1);
    }
    return !0;
  }
  function he(e, B) {
    var W, ne = e.tag, Y = e.anchor, re = [], Z, oe = !1, ue;
    if (e.firstTabInLine !== -1) return !1;
    for (e.anchor !== null && (e.anchorMap[e.anchor] = re), ue = e.input.charCodeAt(e.position); ue !== 0 && (e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, D(e, "tab characters must not be used in indentation")), !(ue !== 45 || (Z = e.input.charCodeAt(e.position + 1), !O(Z)))); ) {
      if (oe = !0, e.position++, ve(e, !0, -1) && e.lineIndent <= B) {
        re.push(null), ue = e.input.charCodeAt(e.position);
        continue;
      }
      if (W = e.line, Ae(e, B, l, !1, !0), re.push(e.result), ve(e, !0, -1), ue = e.input.charCodeAt(e.position), (e.line === W || e.lineIndent > B) && ue !== 0)
        D(e, "bad indentation of a sequence entry");
      else if (e.lineIndent < B)
        break;
    }
    return oe ? (e.tag = ne, e.anchor = Y, e.kind = "sequence", e.result = re, !0) : !1;
  }
  function pe(e, B, W) {
    var ne, Y, re, Z, oe, ue, Te = e.tag, Se = e.anchor, me = {}, R = /* @__PURE__ */ Object.create(null), M = null, z = null, X = null, K = !1, ae = !1, ee;
    if (e.firstTabInLine !== -1) return !1;
    for (e.anchor !== null && (e.anchorMap[e.anchor] = me), ee = e.input.charCodeAt(e.position); ee !== 0; ) {
      if (!K && e.firstTabInLine !== -1 && (e.position = e.firstTabInLine, D(e, "tab characters must not be used in indentation")), ne = e.input.charCodeAt(e.position + 1), re = e.line, (ee === 63 || ee === 58) && O(ne))
        ee === 63 ? (K && (ie(e, me, R, M, z, null, Z, oe, ue), M = z = X = null), ae = !0, K = !0, Y = !0) : K ? (K = !1, Y = !0) : D(e, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line"), e.position += 1, ee = ne;
      else {
        if (Z = e.line, oe = e.lineStart, ue = e.position, !Ae(e, W, a, !1, !0))
          break;
        if (e.line === re) {
          for (ee = e.input.charCodeAt(e.position); P(ee); )
            ee = e.input.charCodeAt(++e.position);
          if (ee === 58)
            ee = e.input.charCodeAt(++e.position), O(ee) || D(e, "a whitespace character is expected after the key-value separator within a block mapping"), K && (ie(e, me, R, M, z, null, Z, oe, ue), M = z = X = null), ae = !0, K = !1, Y = !1, M = e.tag, z = e.result;
          else if (ae)
            D(e, "can not read an implicit mapping pair; a colon is missed");
          else
            return e.tag = Te, e.anchor = Se, !0;
        } else if (ae)
          D(e, "can not read a block mapping entry; a multiline key may not be an implicit key");
        else
          return e.tag = Te, e.anchor = Se, !0;
      }
      if ((e.line === re || e.lineIndent > B) && (K && (Z = e.line, oe = e.lineStart, ue = e.position), Ae(e, B, o, !0, Y) && (K ? z = e.result : X = e.result), K || (ie(e, me, R, M, z, X, Z, oe, ue), M = z = X = null), ve(e, !0, -1), ee = e.input.charCodeAt(e.position)), (e.line === re || e.lineIndent > B) && ee !== 0)
        D(e, "bad indentation of a mapping entry");
      else if (e.lineIndent < B)
        break;
    }
    return K && ie(e, me, R, M, z, null, Z, oe, ue), ae && (e.tag = Te, e.anchor = Se, e.kind = "mapping", e.result = me), ae;
  }
  function _e(e) {
    var B, W = !1, ne = !1, Y, re, Z;
    if (Z = e.input.charCodeAt(e.position), Z !== 33) return !1;
    if (e.tag !== null && D(e, "duplication of a tag property"), Z = e.input.charCodeAt(++e.position), Z === 60 ? (W = !0, Z = e.input.charCodeAt(++e.position)) : Z === 33 ? (ne = !0, Y = "!!", Z = e.input.charCodeAt(++e.position)) : Y = "!", B = e.position, W) {
      do
        Z = e.input.charCodeAt(++e.position);
      while (Z !== 0 && Z !== 62);
      e.position < e.length ? (re = e.input.slice(B, e.position), Z = e.input.charCodeAt(++e.position)) : D(e, "unexpected end of the stream within a verbatim tag");
    } else {
      for (; Z !== 0 && !O(Z); )
        Z === 33 && (ne ? D(e, "tag suffix cannot contain exclamation marks") : (Y = e.input.slice(B - 1, e.position + 1), y.test(Y) || D(e, "named tag handle cannot contain such characters"), ne = !0, B = e.position + 1)), Z = e.input.charCodeAt(++e.position);
      re = e.input.slice(B, e.position), g.test(re) && D(e, "tag suffix cannot contain flow indicator characters");
    }
    re && !m.test(re) && D(e, "tag name cannot contain such characters: " + re);
    try {
      re = decodeURIComponent(re);
    } catch {
      D(e, "tag name is malformed: " + re);
    }
    return W ? e.tag = re : f.call(e.tagMap, Y) ? e.tag = e.tagMap[Y] + re : Y === "!" ? e.tag = "!" + re : Y === "!!" ? e.tag = "tag:yaml.org,2002:" + re : D(e, 'undeclared tag handle "' + Y + '"'), !0;
  }
  function Ee(e) {
    var B, W;
    if (W = e.input.charCodeAt(e.position), W !== 38) return !1;
    for (e.anchor !== null && D(e, "duplication of an anchor property"), W = e.input.charCodeAt(++e.position), B = e.position; W !== 0 && !O(W) && !b(W); )
      W = e.input.charCodeAt(++e.position);
    return e.position === B && D(e, "name of an anchor node must contain at least one character"), e.anchor = e.input.slice(B, e.position), !0;
  }
  function He(e) {
    var B, W, ne;
    if (ne = e.input.charCodeAt(e.position), ne !== 42) return !1;
    for (ne = e.input.charCodeAt(++e.position), B = e.position; ne !== 0 && !O(ne) && !b(ne); )
      ne = e.input.charCodeAt(++e.position);
    return e.position === B && D(e, "name of an alias node must contain at least one character"), W = e.input.slice(B, e.position), f.call(e.anchorMap, W) || D(e, 'unidentified alias "' + W + '"'), e.result = e.anchorMap[W], ve(e, !0, -1), !0;
  }
  function Ae(e, B, W, ne, Y) {
    var re, Z, oe, ue = 1, Te = !1, Se = !1, me, R, M, z, X, K;
    if (e.listener !== null && e.listener("open", e), e.tag = null, e.anchor = null, e.kind = null, e.result = null, re = Z = oe = o === W || l === W, ne && ve(e, !0, -1) && (Te = !0, e.lineIndent > B ? ue = 1 : e.lineIndent === B ? ue = 0 : e.lineIndent < B && (ue = -1)), ue === 1)
      for (; _e(e) || Ee(e); )
        ve(e, !0, -1) ? (Te = !0, oe = re, e.lineIndent > B ? ue = 1 : e.lineIndent === B ? ue = 0 : e.lineIndent < B && (ue = -1)) : oe = !1;
    if (oe && (oe = Te || Y), (ue === 1 || o === W) && (u === W || a === W ? X = B : X = B + 1, K = e.position - e.lineStart, ue === 1 ? oe && (he(e, K) || pe(e, K, X)) || F(e, X) ? Se = !0 : (Z && ce(e, X) || E(e, X) || H(e, X) ? Se = !0 : He(e) ? (Se = !0, (e.tag !== null || e.anchor !== null) && D(e, "alias node should not have any properties")) : w(e, X, u === W) && (Se = !0, e.tag === null && (e.tag = "?")), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : ue === 0 && (Se = oe && he(e, K))), e.tag === null)
      e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
    else if (e.tag === "?") {
      for (e.result !== null && e.kind !== "scalar" && D(e, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + e.kind + '"'), me = 0, R = e.implicitTypes.length; me < R; me += 1)
        if (z = e.implicitTypes[me], z.resolve(e.result)) {
          e.result = z.construct(e.result), e.tag = z.tag, e.anchor !== null && (e.anchorMap[e.anchor] = e.result);
          break;
        }
    } else if (e.tag !== "!") {
      if (f.call(e.typeMap[e.kind || "fallback"], e.tag))
        z = e.typeMap[e.kind || "fallback"][e.tag];
      else
        for (z = null, M = e.typeMap.multi[e.kind || "fallback"], me = 0, R = M.length; me < R; me += 1)
          if (e.tag.slice(0, M[me].tag.length) === M[me].tag) {
            z = M[me];
            break;
          }
      z || D(e, "unknown tag !<" + e.tag + ">"), e.result !== null && z.kind !== e.kind && D(e, "unacceptable node kind for !<" + e.tag + '> tag; it should be "' + z.kind + '", not "' + e.kind + '"'), z.resolve(e.result, e.tag) ? (e.result = z.construct(e.result, e.tag), e.anchor !== null && (e.anchorMap[e.anchor] = e.result)) : D(e, "cannot resolve a node with !<" + e.tag + "> explicit tag");
    }
    return e.listener !== null && e.listener("close", e), e.tag !== null || e.anchor !== null || Se;
  }
  function $e(e) {
    var B = e.position, W, ne, Y, re = !1, Z;
    for (e.version = null, e.checkLineBreaks = e.legacy, e.tagMap = /* @__PURE__ */ Object.create(null), e.anchorMap = /* @__PURE__ */ Object.create(null); (Z = e.input.charCodeAt(e.position)) !== 0 && (ve(e, !0, -1), Z = e.input.charCodeAt(e.position), !(e.lineIndent > 0 || Z !== 37)); ) {
      for (re = !0, Z = e.input.charCodeAt(++e.position), W = e.position; Z !== 0 && !O(Z); )
        Z = e.input.charCodeAt(++e.position);
      for (ne = e.input.slice(W, e.position), Y = [], ne.length < 1 && D(e, "directive name must not be less than one character in length"); Z !== 0; ) {
        for (; P(Z); )
          Z = e.input.charCodeAt(++e.position);
        if (Z === 35) {
          do
            Z = e.input.charCodeAt(++e.position);
          while (Z !== 0 && !T(Z));
          break;
        }
        if (T(Z)) break;
        for (W = e.position; Z !== 0 && !O(Z); )
          Z = e.input.charCodeAt(++e.position);
        Y.push(e.input.slice(W, e.position));
      }
      Z !== 0 && we(e), f.call(V, ne) ? V[ne](e, ne, Y) : G(e, 'unknown document directive "' + ne + '"');
    }
    if (ve(e, !0, -1), e.lineIndent === 0 && e.input.charCodeAt(e.position) === 45 && e.input.charCodeAt(e.position + 1) === 45 && e.input.charCodeAt(e.position + 2) === 45 ? (e.position += 3, ve(e, !0, -1)) : re && D(e, "directives end mark is expected"), Ae(e, e.lineIndent - 1, o, !1, !0), ve(e, !0, -1), e.checkLineBreaks && h.test(e.input.slice(B, e.position)) && G(e, "non-ASCII line breaks are interpreted as content"), e.documents.push(e.result), e.position === e.lineStart && Q(e)) {
      e.input.charCodeAt(e.position) === 46 && (e.position += 3, ve(e, !0, -1));
      return;
    }
    if (e.position < e.length - 1)
      D(e, "end of the stream or a document separator is expected");
    else
      return;
  }
  function lt(e, B) {
    e = String(e), B = B || {}, e.length !== 0 && (e.charCodeAt(e.length - 1) !== 10 && e.charCodeAt(e.length - 1) !== 13 && (e += `
`), e.charCodeAt(0) === 65279 && (e = e.slice(1)));
    var W = new N(e, B), ne = e.indexOf("\0");
    for (ne !== -1 && (W.position = ne, D(W, "null byte is not allowed in input")), W.input += "\0"; W.input.charCodeAt(W.position) === 32; )
      W.lineIndent += 1, W.position += 1;
    for (; W.position < W.length - 1; )
      $e(W);
    return W.documents;
  }
  function nt(e, B, W) {
    B !== null && typeof B == "object" && typeof W > "u" && (W = B, B = null);
    var ne = lt(e, W);
    if (typeof B != "function")
      return ne;
    for (var Y = 0, re = ne.length; Y < re; Y += 1)
      B(ne[Y]);
  }
  function tt(e, B) {
    var W = lt(e, B);
    if (W.length !== 0) {
      if (W.length === 1)
        return W[0];
      throw new d("expected a single document in the stream, but found more");
    }
  }
  return kr.loadAll = nt, kr.load = tt, kr;
}
var ui = {}, rs;
function mf() {
  if (rs) return ui;
  rs = 1;
  var t = yr(), d = wr(), p = ua(), c = Object.prototype.toString, f = Object.prototype.hasOwnProperty, u = 65279, a = 9, l = 10, o = 13, s = 32, i = 33, r = 34, n = 35, h = 37, g = 38, y = 39, m = 42, _ = 44, T = 45, P = 58, O = 61, b = 62, I = 63, S = 64, A = 91, v = 93, k = 96, q = 123, x = 124, $ = 125, L = {};
  L[0] = "\\0", L[7] = "\\a", L[8] = "\\b", L[9] = "\\t", L[10] = "\\n", L[11] = "\\v", L[12] = "\\f", L[13] = "\\r", L[27] = "\\e", L[34] = '\\"', L[92] = "\\\\", L[133] = "\\N", L[160] = "\\_", L[8232] = "\\L", L[8233] = "\\P";
  var N = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ], j = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function D(R, M) {
    var z, X, K, ae, ee, se, fe;
    if (M === null) return {};
    for (z = {}, X = Object.keys(M), K = 0, ae = X.length; K < ae; K += 1)
      ee = X[K], se = String(M[ee]), ee.slice(0, 2) === "!!" && (ee = "tag:yaml.org,2002:" + ee.slice(2)), fe = R.compiledTypeMap.fallback[ee], fe && f.call(fe.styleAliases, se) && (se = fe.styleAliases[se]), z[ee] = se;
    return z;
  }
  function G(R) {
    var M, z, X;
    if (M = R.toString(16).toUpperCase(), R <= 255)
      z = "x", X = 2;
    else if (R <= 65535)
      z = "u", X = 4;
    else if (R <= 4294967295)
      z = "U", X = 8;
    else
      throw new d("code point within a string may not be greater than 0xFFFFFFFF");
    return "\\" + z + t.repeat("0", X - M.length) + M;
  }
  var V = 1, te = 2;
  function de(R) {
    this.schema = R.schema || p, this.indent = Math.max(1, R.indent || 2), this.noArrayIndent = R.noArrayIndent || !1, this.skipInvalid = R.skipInvalid || !1, this.flowLevel = t.isNothing(R.flowLevel) ? -1 : R.flowLevel, this.styleMap = D(this.schema, R.styles || null), this.sortKeys = R.sortKeys || !1, this.lineWidth = R.lineWidth || 80, this.noRefs = R.noRefs || !1, this.noCompatMode = R.noCompatMode || !1, this.condenseFlow = R.condenseFlow || !1, this.quotingType = R.quotingType === '"' ? te : V, this.forceQuotes = R.forceQuotes || !1, this.replacer = typeof R.replacer == "function" ? R.replacer : null, this.implicitTypes = this.schema.compiledImplicit, this.explicitTypes = this.schema.compiledExplicit, this.tag = null, this.result = "", this.duplicates = [], this.usedDuplicates = null;
  }
  function ie(R, M) {
    for (var z = t.repeat(" ", M), X = 0, K = -1, ae = "", ee, se = R.length; X < se; )
      K = R.indexOf(`
`, X), K === -1 ? (ee = R.slice(X), X = se) : (ee = R.slice(X, K + 1), X = K + 1), ee.length && ee !== `
` && (ae += z), ae += ee;
    return ae;
  }
  function we(R, M) {
    return `
` + t.repeat(" ", R.indent * M);
  }
  function ve(R, M) {
    var z, X, K;
    for (z = 0, X = R.implicitTypes.length; z < X; z += 1)
      if (K = R.implicitTypes[z], K.resolve(M))
        return !0;
    return !1;
  }
  function Q(R) {
    return R === s || R === a;
  }
  function ge(R) {
    return 32 <= R && R <= 126 || 161 <= R && R <= 55295 && R !== 8232 && R !== 8233 || 57344 <= R && R <= 65533 && R !== u || 65536 <= R && R <= 1114111;
  }
  function w(R) {
    return ge(R) && R !== u && R !== o && R !== l;
  }
  function E(R, M, z) {
    var X = w(R), K = X && !Q(R);
    return (
      // ns-plain-safe
      (z ? (
        // c = flow-in
        X
      ) : X && R !== _ && R !== A && R !== v && R !== q && R !== $) && R !== n && !(M === P && !K) || w(M) && !Q(M) && R === n || M === P && K
    );
  }
  function H(R) {
    return ge(R) && R !== u && !Q(R) && R !== T && R !== I && R !== P && R !== _ && R !== A && R !== v && R !== q && R !== $ && R !== n && R !== g && R !== m && R !== i && R !== x && R !== O && R !== b && R !== y && R !== r && R !== h && R !== S && R !== k;
  }
  function F(R) {
    return !Q(R) && R !== P;
  }
  function ce(R, M) {
    var z = R.charCodeAt(M), X;
    return z >= 55296 && z <= 56319 && M + 1 < R.length && (X = R.charCodeAt(M + 1), X >= 56320 && X <= 57343) ? (z - 55296) * 1024 + X - 56320 + 65536 : z;
  }
  function he(R) {
    var M = /^\n* /;
    return M.test(R);
  }
  var pe = 1, _e = 2, Ee = 3, He = 4, Ae = 5;
  function $e(R, M, z, X, K, ae, ee, se) {
    var fe, ye = 0, be = null, De = !1, Ce = !1, Nt = X !== -1, Ke = -1, Et = H(ce(R, 0)) && F(ce(R, R.length - 1));
    if (M || ee)
      for (fe = 0; fe < R.length; ye >= 65536 ? fe += 2 : fe++) {
        if (ye = ce(R, fe), !ge(ye))
          return Ae;
        Et = Et && E(ye, be, se), be = ye;
      }
    else {
      for (fe = 0; fe < R.length; ye >= 65536 ? fe += 2 : fe++) {
        if (ye = ce(R, fe), ye === l)
          De = !0, Nt && (Ce = Ce || // Foldable line = too long, and not more-indented.
          fe - Ke - 1 > X && R[Ke + 1] !== " ", Ke = fe);
        else if (!ge(ye))
          return Ae;
        Et = Et && E(ye, be, se), be = ye;
      }
      Ce = Ce || Nt && fe - Ke - 1 > X && R[Ke + 1] !== " ";
    }
    return !De && !Ce ? Et && !ee && !K(R) ? pe : ae === te ? Ae : _e : z > 9 && he(R) ? Ae : ee ? ae === te ? Ae : _e : Ce ? He : Ee;
  }
  function lt(R, M, z, X, K) {
    R.dump = (function() {
      if (M.length === 0)
        return R.quotingType === te ? '""' : "''";
      if (!R.noCompatMode && (N.indexOf(M) !== -1 || j.test(M)))
        return R.quotingType === te ? '"' + M + '"' : "'" + M + "'";
      var ae = R.indent * Math.max(1, z), ee = R.lineWidth === -1 ? -1 : Math.max(Math.min(R.lineWidth, 40), R.lineWidth - ae), se = X || R.flowLevel > -1 && z >= R.flowLevel;
      function fe(ye) {
        return ve(R, ye);
      }
      switch ($e(
        M,
        se,
        R.indent,
        ee,
        fe,
        R.quotingType,
        R.forceQuotes && !X,
        K
      )) {
        case pe:
          return M;
        case _e:
          return "'" + M.replace(/'/g, "''") + "'";
        case Ee:
          return "|" + nt(M, R.indent) + tt(ie(M, ae));
        case He:
          return ">" + nt(M, R.indent) + tt(ie(e(M, ee), ae));
        case Ae:
          return '"' + W(M) + '"';
        default:
          throw new d("impossible error: invalid scalar style");
      }
    })();
  }
  function nt(R, M) {
    var z = he(R) ? String(M) : "", X = R[R.length - 1] === `
`, K = X && (R[R.length - 2] === `
` || R === `
`), ae = K ? "+" : X ? "" : "-";
    return z + ae + `
`;
  }
  function tt(R) {
    return R[R.length - 1] === `
` ? R.slice(0, -1) : R;
  }
  function e(R, M) {
    for (var z = /(\n+)([^\n]*)/g, X = (function() {
      var ye = R.indexOf(`
`);
      return ye = ye !== -1 ? ye : R.length, z.lastIndex = ye, B(R.slice(0, ye), M);
    })(), K = R[0] === `
` || R[0] === " ", ae, ee; ee = z.exec(R); ) {
      var se = ee[1], fe = ee[2];
      ae = fe[0] === " ", X += se + (!K && !ae && fe !== "" ? `
` : "") + B(fe, M), K = ae;
    }
    return X;
  }
  function B(R, M) {
    if (R === "" || R[0] === " ") return R;
    for (var z = / [^ ]/g, X, K = 0, ae, ee = 0, se = 0, fe = ""; X = z.exec(R); )
      se = X.index, se - K > M && (ae = ee > K ? ee : se, fe += `
` + R.slice(K, ae), K = ae + 1), ee = se;
    return fe += `
`, R.length - K > M && ee > K ? fe += R.slice(K, ee) + `
` + R.slice(ee + 1) : fe += R.slice(K), fe.slice(1);
  }
  function W(R) {
    for (var M = "", z = 0, X, K = 0; K < R.length; z >= 65536 ? K += 2 : K++)
      z = ce(R, K), X = L[z], !X && ge(z) ? (M += R[K], z >= 65536 && (M += R[K + 1])) : M += X || G(z);
    return M;
  }
  function ne(R, M, z) {
    var X = "", K = R.tag, ae, ee, se;
    for (ae = 0, ee = z.length; ae < ee; ae += 1)
      se = z[ae], R.replacer && (se = R.replacer.call(z, String(ae), se)), (ue(R, M, se, !1, !1) || typeof se > "u" && ue(R, M, null, !1, !1)) && (X !== "" && (X += "," + (R.condenseFlow ? "" : " ")), X += R.dump);
    R.tag = K, R.dump = "[" + X + "]";
  }
  function Y(R, M, z, X) {
    var K = "", ae = R.tag, ee, se, fe;
    for (ee = 0, se = z.length; ee < se; ee += 1)
      fe = z[ee], R.replacer && (fe = R.replacer.call(z, String(ee), fe)), (ue(R, M + 1, fe, !0, !0, !1, !0) || typeof fe > "u" && ue(R, M + 1, null, !0, !0, !1, !0)) && ((!X || K !== "") && (K += we(R, M)), R.dump && l === R.dump.charCodeAt(0) ? K += "-" : K += "- ", K += R.dump);
    R.tag = ae, R.dump = K || "[]";
  }
  function re(R, M, z) {
    var X = "", K = R.tag, ae = Object.keys(z), ee, se, fe, ye, be;
    for (ee = 0, se = ae.length; ee < se; ee += 1)
      be = "", X !== "" && (be += ", "), R.condenseFlow && (be += '"'), fe = ae[ee], ye = z[fe], R.replacer && (ye = R.replacer.call(z, fe, ye)), ue(R, M, fe, !1, !1) && (R.dump.length > 1024 && (be += "? "), be += R.dump + (R.condenseFlow ? '"' : "") + ":" + (R.condenseFlow ? "" : " "), ue(R, M, ye, !1, !1) && (be += R.dump, X += be));
    R.tag = K, R.dump = "{" + X + "}";
  }
  function Z(R, M, z, X) {
    var K = "", ae = R.tag, ee = Object.keys(z), se, fe, ye, be, De, Ce;
    if (R.sortKeys === !0)
      ee.sort();
    else if (typeof R.sortKeys == "function")
      ee.sort(R.sortKeys);
    else if (R.sortKeys)
      throw new d("sortKeys must be a boolean or a function");
    for (se = 0, fe = ee.length; se < fe; se += 1)
      Ce = "", (!X || K !== "") && (Ce += we(R, M)), ye = ee[se], be = z[ye], R.replacer && (be = R.replacer.call(z, ye, be)), ue(R, M + 1, ye, !0, !0, !0) && (De = R.tag !== null && R.tag !== "?" || R.dump && R.dump.length > 1024, De && (R.dump && l === R.dump.charCodeAt(0) ? Ce += "?" : Ce += "? "), Ce += R.dump, De && (Ce += we(R, M)), ue(R, M + 1, be, !0, De) && (R.dump && l === R.dump.charCodeAt(0) ? Ce += ":" : Ce += ": ", Ce += R.dump, K += Ce));
    R.tag = ae, R.dump = K || "{}";
  }
  function oe(R, M, z) {
    var X, K, ae, ee, se, fe;
    for (K = z ? R.explicitTypes : R.implicitTypes, ae = 0, ee = K.length; ae < ee; ae += 1)
      if (se = K[ae], (se.instanceOf || se.predicate) && (!se.instanceOf || typeof M == "object" && M instanceof se.instanceOf) && (!se.predicate || se.predicate(M))) {
        if (z ? se.multi && se.representName ? R.tag = se.representName(M) : R.tag = se.tag : R.tag = "?", se.represent) {
          if (fe = R.styleMap[se.tag] || se.defaultStyle, c.call(se.represent) === "[object Function]")
            X = se.represent(M, fe);
          else if (f.call(se.represent, fe))
            X = se.represent[fe](M, fe);
          else
            throw new d("!<" + se.tag + '> tag resolver accepts not "' + fe + '" style');
          R.dump = X;
        }
        return !0;
      }
    return !1;
  }
  function ue(R, M, z, X, K, ae, ee) {
    R.tag = null, R.dump = z, oe(R, z, !1) || oe(R, z, !0);
    var se = c.call(R.dump), fe = X, ye;
    X && (X = R.flowLevel < 0 || R.flowLevel > M);
    var be = se === "[object Object]" || se === "[object Array]", De, Ce;
    if (be && (De = R.duplicates.indexOf(z), Ce = De !== -1), (R.tag !== null && R.tag !== "?" || Ce || R.indent !== 2 && M > 0) && (K = !1), Ce && R.usedDuplicates[De])
      R.dump = "*ref_" + De;
    else {
      if (be && Ce && !R.usedDuplicates[De] && (R.usedDuplicates[De] = !0), se === "[object Object]")
        X && Object.keys(R.dump).length !== 0 ? (Z(R, M, R.dump, K), Ce && (R.dump = "&ref_" + De + R.dump)) : (re(R, M, R.dump), Ce && (R.dump = "&ref_" + De + " " + R.dump));
      else if (se === "[object Array]")
        X && R.dump.length !== 0 ? (R.noArrayIndent && !ee && M > 0 ? Y(R, M - 1, R.dump, K) : Y(R, M, R.dump, K), Ce && (R.dump = "&ref_" + De + R.dump)) : (ne(R, M, R.dump), Ce && (R.dump = "&ref_" + De + " " + R.dump));
      else if (se === "[object String]")
        R.tag !== "?" && lt(R, R.dump, M, ae, fe);
      else {
        if (se === "[object Undefined]")
          return !1;
        if (R.skipInvalid) return !1;
        throw new d("unacceptable kind of an object to dump " + se);
      }
      R.tag !== null && R.tag !== "?" && (ye = encodeURI(
        R.tag[0] === "!" ? R.tag.slice(1) : R.tag
      ).replace(/!/g, "%21"), R.tag[0] === "!" ? ye = "!" + ye : ye.slice(0, 18) === "tag:yaml.org,2002:" ? ye = "!!" + ye.slice(18) : ye = "!<" + ye + ">", R.dump = ye + " " + R.dump);
    }
    return !0;
  }
  function Te(R, M) {
    var z = [], X = [], K, ae;
    for (Se(R, z, X), K = 0, ae = X.length; K < ae; K += 1)
      M.duplicates.push(z[X[K]]);
    M.usedDuplicates = new Array(ae);
  }
  function Se(R, M, z) {
    var X, K, ae;
    if (R !== null && typeof R == "object")
      if (K = M.indexOf(R), K !== -1)
        z.indexOf(K) === -1 && z.push(K);
      else if (M.push(R), Array.isArray(R))
        for (K = 0, ae = R.length; K < ae; K += 1)
          Se(R[K], M, z);
      else
        for (X = Object.keys(R), K = 0, ae = X.length; K < ae; K += 1)
          Se(R[X[K]], M, z);
  }
  function me(R, M) {
    M = M || {};
    var z = new de(M);
    z.noRefs || Te(R, z);
    var X = R;
    return z.replacer && (X = z.replacer.call({ "": X }, "", X)), ue(z, 0, X, !0, !0) ? z.dump + `
` : "";
  }
  return ui.dump = me, ui;
}
var ns;
function ca() {
  if (ns) return qe;
  ns = 1;
  var t = pf(), d = mf();
  function p(c, f) {
    return function() {
      throw new Error("Function yaml." + c + " is removed in js-yaml 4. Use yaml." + f + " instead, which is now safe by default.");
    };
  }
  return qe.Type = Me(), qe.Schema = Gl(), qe.FAILSAFE_SCHEMA = zl(), qe.JSON_SCHEMA = Zl(), qe.CORE_SCHEMA = eu(), qe.DEFAULT_SCHEMA = ua(), qe.load = t.load, qe.loadAll = t.loadAll, qe.dump = d.dump, qe.YAMLException = wr(), qe.types = {
    binary: nu(),
    float: Ql(),
    map: Yl(),
    null: Xl(),
    pairs: au(),
    set: ou(),
    timestamp: tu(),
    bool: Kl(),
    int: Jl(),
    merge: ru(),
    omap: iu(),
    seq: Vl(),
    str: Wl()
  }, qe.safeLoad = p("safeLoad", "load"), qe.safeLoadAll = p("safeLoadAll", "loadAll"), qe.safeDump = p("safeDump", "dump"), qe;
}
var Xt = {}, is;
function gf() {
  if (is) return Xt;
  is = 1, Object.defineProperty(Xt, "__esModule", { value: !0 }), Xt.Lazy = void 0;
  class t {
    constructor(p) {
      this._value = null, this.creator = p;
    }
    get hasValue() {
      return this.creator == null;
    }
    get value() {
      if (this.creator == null)
        return this._value;
      const p = this.creator();
      return this.value = p, p;
    }
    set value(p) {
      this._value = p, this.creator = null;
    }
  }
  return Xt.Lazy = t, Xt;
}
var qr = { exports: {} }, ci, as;
function zr() {
  if (as) return ci;
  as = 1;
  const t = "2.0.0", d = 256, p = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
  9007199254740991, c = 16, f = d - 6;
  return ci = {
    MAX_LENGTH: d,
    MAX_SAFE_COMPONENT_LENGTH: c,
    MAX_SAFE_BUILD_LENGTH: f,
    MAX_SAFE_INTEGER: p,
    RELEASE_TYPES: [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ],
    SEMVER_SPEC_VERSION: t,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  }, ci;
}
var fi, os;
function Xr() {
  return os || (os = 1, fi = typeof process == "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...d) => console.error("SEMVER", ...d) : () => {
  }), fi;
}
var ss;
function _r() {
  return ss || (ss = 1, (function(t, d) {
    const {
      MAX_SAFE_COMPONENT_LENGTH: p,
      MAX_SAFE_BUILD_LENGTH: c,
      MAX_LENGTH: f
    } = zr(), u = Xr();
    d = t.exports = {};
    const a = d.re = [], l = d.safeRe = [], o = d.src = [], s = d.safeSrc = [], i = d.t = {};
    let r = 0;
    const n = "[a-zA-Z0-9-]", h = [
      ["\\s", 1],
      ["\\d", f],
      [n, c]
    ], g = (m) => {
      for (const [_, T] of h)
        m = m.split(`${_}*`).join(`${_}{0,${T}}`).split(`${_}+`).join(`${_}{1,${T}}`);
      return m;
    }, y = (m, _, T) => {
      const P = g(_), O = r++;
      u(m, O, _), i[m] = O, o[O] = _, s[O] = P, a[O] = new RegExp(_, T ? "g" : void 0), l[O] = new RegExp(P, T ? "g" : void 0);
    };
    y("NUMERICIDENTIFIER", "0|[1-9]\\d*"), y("NUMERICIDENTIFIERLOOSE", "\\d+"), y("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${n}*`), y("MAINVERSION", `(${o[i.NUMERICIDENTIFIER]})\\.(${o[i.NUMERICIDENTIFIER]})\\.(${o[i.NUMERICIDENTIFIER]})`), y("MAINVERSIONLOOSE", `(${o[i.NUMERICIDENTIFIERLOOSE]})\\.(${o[i.NUMERICIDENTIFIERLOOSE]})\\.(${o[i.NUMERICIDENTIFIERLOOSE]})`), y("PRERELEASEIDENTIFIER", `(?:${o[i.NONNUMERICIDENTIFIER]}|${o[i.NUMERICIDENTIFIER]})`), y("PRERELEASEIDENTIFIERLOOSE", `(?:${o[i.NONNUMERICIDENTIFIER]}|${o[i.NUMERICIDENTIFIERLOOSE]})`), y("PRERELEASE", `(?:-(${o[i.PRERELEASEIDENTIFIER]}(?:\\.${o[i.PRERELEASEIDENTIFIER]})*))`), y("PRERELEASELOOSE", `(?:-?(${o[i.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${o[i.PRERELEASEIDENTIFIERLOOSE]})*))`), y("BUILDIDENTIFIER", `${n}+`), y("BUILD", `(?:\\+(${o[i.BUILDIDENTIFIER]}(?:\\.${o[i.BUILDIDENTIFIER]})*))`), y("FULLPLAIN", `v?${o[i.MAINVERSION]}${o[i.PRERELEASE]}?${o[i.BUILD]}?`), y("FULL", `^${o[i.FULLPLAIN]}$`), y("LOOSEPLAIN", `[v=\\s]*${o[i.MAINVERSIONLOOSE]}${o[i.PRERELEASELOOSE]}?${o[i.BUILD]}?`), y("LOOSE", `^${o[i.LOOSEPLAIN]}$`), y("GTLT", "((?:<|>)?=?)"), y("XRANGEIDENTIFIERLOOSE", `${o[i.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`), y("XRANGEIDENTIFIER", `${o[i.NUMERICIDENTIFIER]}|x|X|\\*`), y("XRANGEPLAIN", `[v=\\s]*(${o[i.XRANGEIDENTIFIER]})(?:\\.(${o[i.XRANGEIDENTIFIER]})(?:\\.(${o[i.XRANGEIDENTIFIER]})(?:${o[i.PRERELEASE]})?${o[i.BUILD]}?)?)?`), y("XRANGEPLAINLOOSE", `[v=\\s]*(${o[i.XRANGEIDENTIFIERLOOSE]})(?:\\.(${o[i.XRANGEIDENTIFIERLOOSE]})(?:\\.(${o[i.XRANGEIDENTIFIERLOOSE]})(?:${o[i.PRERELEASELOOSE]})?${o[i.BUILD]}?)?)?`), y("XRANGE", `^${o[i.GTLT]}\\s*${o[i.XRANGEPLAIN]}$`), y("XRANGELOOSE", `^${o[i.GTLT]}\\s*${o[i.XRANGEPLAINLOOSE]}$`), y("COERCEPLAIN", `(^|[^\\d])(\\d{1,${p}})(?:\\.(\\d{1,${p}}))?(?:\\.(\\d{1,${p}}))?`), y("COERCE", `${o[i.COERCEPLAIN]}(?:$|[^\\d])`), y("COERCEFULL", o[i.COERCEPLAIN] + `(?:${o[i.PRERELEASE]})?(?:${o[i.BUILD]})?(?:$|[^\\d])`), y("COERCERTL", o[i.COERCE], !0), y("COERCERTLFULL", o[i.COERCEFULL], !0), y("LONETILDE", "(?:~>?)"), y("TILDETRIM", `(\\s*)${o[i.LONETILDE]}\\s+`, !0), d.tildeTrimReplace = "$1~", y("TILDE", `^${o[i.LONETILDE]}${o[i.XRANGEPLAIN]}$`), y("TILDELOOSE", `^${o[i.LONETILDE]}${o[i.XRANGEPLAINLOOSE]}$`), y("LONECARET", "(?:\\^)"), y("CARETTRIM", `(\\s*)${o[i.LONECARET]}\\s+`, !0), d.caretTrimReplace = "$1^", y("CARET", `^${o[i.LONECARET]}${o[i.XRANGEPLAIN]}$`), y("CARETLOOSE", `^${o[i.LONECARET]}${o[i.XRANGEPLAINLOOSE]}$`), y("COMPARATORLOOSE", `^${o[i.GTLT]}\\s*(${o[i.LOOSEPLAIN]})$|^$`), y("COMPARATOR", `^${o[i.GTLT]}\\s*(${o[i.FULLPLAIN]})$|^$`), y("COMPARATORTRIM", `(\\s*)${o[i.GTLT]}\\s*(${o[i.LOOSEPLAIN]}|${o[i.XRANGEPLAIN]})`, !0), d.comparatorTrimReplace = "$1$2$3", y("HYPHENRANGE", `^\\s*(${o[i.XRANGEPLAIN]})\\s+-\\s+(${o[i.XRANGEPLAIN]})\\s*$`), y("HYPHENRANGELOOSE", `^\\s*(${o[i.XRANGEPLAINLOOSE]})\\s+-\\s+(${o[i.XRANGEPLAINLOOSE]})\\s*$`), y("STAR", "(<|>)?=?\\s*\\*"), y("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$"), y("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  })(qr, qr.exports)), qr.exports;
}
var di, ls;
function fa() {
  if (ls) return di;
  ls = 1;
  const t = Object.freeze({ loose: !0 }), d = Object.freeze({});
  return di = (c) => c ? typeof c != "object" ? t : c : d, di;
}
var hi, us;
function su() {
  if (us) return hi;
  us = 1;
  const t = /^[0-9]+$/, d = (c, f) => {
    if (typeof c == "number" && typeof f == "number")
      return c === f ? 0 : c < f ? -1 : 1;
    const u = t.test(c), a = t.test(f);
    return u && a && (c = +c, f = +f), c === f ? 0 : u && !a ? -1 : a && !u ? 1 : c < f ? -1 : 1;
  };
  return hi = {
    compareIdentifiers: d,
    rcompareIdentifiers: (c, f) => d(f, c)
  }, hi;
}
var pi, cs;
function Be() {
  if (cs) return pi;
  cs = 1;
  const t = Xr(), { MAX_LENGTH: d, MAX_SAFE_INTEGER: p } = zr(), { safeRe: c, t: f } = _r(), u = fa(), { compareIdentifiers: a } = su();
  class l {
    constructor(s, i) {
      if (i = u(i), s instanceof l) {
        if (s.loose === !!i.loose && s.includePrerelease === !!i.includePrerelease)
          return s;
        s = s.version;
      } else if (typeof s != "string")
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof s}".`);
      if (s.length > d)
        throw new TypeError(
          `version is longer than ${d} characters`
        );
      t("SemVer", s, i), this.options = i, this.loose = !!i.loose, this.includePrerelease = !!i.includePrerelease;
      const r = s.trim().match(i.loose ? c[f.LOOSE] : c[f.FULL]);
      if (!r)
        throw new TypeError(`Invalid Version: ${s}`);
      if (this.raw = s, this.major = +r[1], this.minor = +r[2], this.patch = +r[3], this.major > p || this.major < 0)
        throw new TypeError("Invalid major version");
      if (this.minor > p || this.minor < 0)
        throw new TypeError("Invalid minor version");
      if (this.patch > p || this.patch < 0)
        throw new TypeError("Invalid patch version");
      r[4] ? this.prerelease = r[4].split(".").map((n) => {
        if (/^[0-9]+$/.test(n)) {
          const h = +n;
          if (h >= 0 && h < p)
            return h;
        }
        return n;
      }) : this.prerelease = [], this.build = r[5] ? r[5].split(".") : [], this.format();
    }
    format() {
      return this.version = `${this.major}.${this.minor}.${this.patch}`, this.prerelease.length && (this.version += `-${this.prerelease.join(".")}`), this.version;
    }
    toString() {
      return this.version;
    }
    compare(s) {
      if (t("SemVer.compare", this.version, this.options, s), !(s instanceof l)) {
        if (typeof s == "string" && s === this.version)
          return 0;
        s = new l(s, this.options);
      }
      return s.version === this.version ? 0 : this.compareMain(s) || this.comparePre(s);
    }
    compareMain(s) {
      return s instanceof l || (s = new l(s, this.options)), this.major < s.major ? -1 : this.major > s.major ? 1 : this.minor < s.minor ? -1 : this.minor > s.minor ? 1 : this.patch < s.patch ? -1 : this.patch > s.patch ? 1 : 0;
    }
    comparePre(s) {
      if (s instanceof l || (s = new l(s, this.options)), this.prerelease.length && !s.prerelease.length)
        return -1;
      if (!this.prerelease.length && s.prerelease.length)
        return 1;
      if (!this.prerelease.length && !s.prerelease.length)
        return 0;
      let i = 0;
      do {
        const r = this.prerelease[i], n = s.prerelease[i];
        if (t("prerelease compare", i, r, n), r === void 0 && n === void 0)
          return 0;
        if (n === void 0)
          return 1;
        if (r === void 0)
          return -1;
        if (r === n)
          continue;
        return a(r, n);
      } while (++i);
    }
    compareBuild(s) {
      s instanceof l || (s = new l(s, this.options));
      let i = 0;
      do {
        const r = this.build[i], n = s.build[i];
        if (t("build compare", i, r, n), r === void 0 && n === void 0)
          return 0;
        if (n === void 0)
          return 1;
        if (r === void 0)
          return -1;
        if (r === n)
          continue;
        return a(r, n);
      } while (++i);
    }
    // preminor will bump the version up to the next minor release, and immediately
    // down to pre-release. premajor and prepatch work the same way.
    inc(s, i, r) {
      if (s.startsWith("pre")) {
        if (!i && r === !1)
          throw new Error("invalid increment argument: identifier is empty");
        if (i) {
          const n = `-${i}`.match(this.options.loose ? c[f.PRERELEASELOOSE] : c[f.PRERELEASE]);
          if (!n || n[1] !== i)
            throw new Error(`invalid identifier: ${i}`);
        }
      }
      switch (s) {
        case "premajor":
          this.prerelease.length = 0, this.patch = 0, this.minor = 0, this.major++, this.inc("pre", i, r);
          break;
        case "preminor":
          this.prerelease.length = 0, this.patch = 0, this.minor++, this.inc("pre", i, r);
          break;
        case "prepatch":
          this.prerelease.length = 0, this.inc("patch", i, r), this.inc("pre", i, r);
          break;
        // If the input is a non-prerelease version, this acts the same as
        // prepatch.
        case "prerelease":
          this.prerelease.length === 0 && this.inc("patch", i, r), this.inc("pre", i, r);
          break;
        case "release":
          if (this.prerelease.length === 0)
            throw new Error(`version ${this.raw} is not a prerelease`);
          this.prerelease.length = 0;
          break;
        case "major":
          (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) && this.major++, this.minor = 0, this.patch = 0, this.prerelease = [];
          break;
        case "minor":
          (this.patch !== 0 || this.prerelease.length === 0) && this.minor++, this.patch = 0, this.prerelease = [];
          break;
        case "patch":
          this.prerelease.length === 0 && this.patch++, this.prerelease = [];
          break;
        // This probably shouldn't be used publicly.
        // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
        case "pre": {
          const n = Number(r) ? 1 : 0;
          if (this.prerelease.length === 0)
            this.prerelease = [n];
          else {
            let h = this.prerelease.length;
            for (; --h >= 0; )
              typeof this.prerelease[h] == "number" && (this.prerelease[h]++, h = -2);
            if (h === -1) {
              if (i === this.prerelease.join(".") && r === !1)
                throw new Error("invalid increment argument: identifier already exists");
              this.prerelease.push(n);
            }
          }
          if (i) {
            let h = [i, n];
            r === !1 && (h = [i]), a(this.prerelease[0], i) === 0 ? isNaN(this.prerelease[1]) && (this.prerelease = h) : this.prerelease = h;
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${s}`);
      }
      return this.raw = this.format(), this.build.length && (this.raw += `+${this.build.join(".")}`), this;
    }
  }
  return pi = l, pi;
}
var mi, fs;
function jt() {
  if (fs) return mi;
  fs = 1;
  const t = Be();
  return mi = (p, c, f = !1) => {
    if (p instanceof t)
      return p;
    try {
      return new t(p, c);
    } catch (u) {
      if (!f)
        return null;
      throw u;
    }
  }, mi;
}
var gi, ds;
function vf() {
  if (ds) return gi;
  ds = 1;
  const t = jt();
  return gi = (p, c) => {
    const f = t(p, c);
    return f ? f.version : null;
  }, gi;
}
var vi, hs;
function Ef() {
  if (hs) return vi;
  hs = 1;
  const t = jt();
  return vi = (p, c) => {
    const f = t(p.trim().replace(/^[=v]+/, ""), c);
    return f ? f.version : null;
  }, vi;
}
var Ei, ps;
function yf() {
  if (ps) return Ei;
  ps = 1;
  const t = Be();
  return Ei = (p, c, f, u, a) => {
    typeof f == "string" && (a = u, u = f, f = void 0);
    try {
      return new t(
        p instanceof t ? p.version : p,
        f
      ).inc(c, u, a).version;
    } catch {
      return null;
    }
  }, Ei;
}
var yi, ms;
function wf() {
  if (ms) return yi;
  ms = 1;
  const t = jt();
  return yi = (p, c) => {
    const f = t(p, null, !0), u = t(c, null, !0), a = f.compare(u);
    if (a === 0)
      return null;
    const l = a > 0, o = l ? f : u, s = l ? u : f, i = !!o.prerelease.length;
    if (!!s.prerelease.length && !i) {
      if (!s.patch && !s.minor)
        return "major";
      if (s.compareMain(o) === 0)
        return s.minor && !s.patch ? "minor" : "patch";
    }
    const n = i ? "pre" : "";
    return f.major !== u.major ? n + "major" : f.minor !== u.minor ? n + "minor" : f.patch !== u.patch ? n + "patch" : "prerelease";
  }, yi;
}
var wi, gs;
function _f() {
  if (gs) return wi;
  gs = 1;
  const t = Be();
  return wi = (p, c) => new t(p, c).major, wi;
}
var _i, vs;
function Rf() {
  if (vs) return _i;
  vs = 1;
  const t = Be();
  return _i = (p, c) => new t(p, c).minor, _i;
}
var Ri, Es;
function Af() {
  if (Es) return Ri;
  Es = 1;
  const t = Be();
  return Ri = (p, c) => new t(p, c).patch, Ri;
}
var Ai, ys;
function Tf() {
  if (ys) return Ai;
  ys = 1;
  const t = jt();
  return Ai = (p, c) => {
    const f = t(p, c);
    return f && f.prerelease.length ? f.prerelease : null;
  }, Ai;
}
var Ti, ws;
function Ze() {
  if (ws) return Ti;
  ws = 1;
  const t = Be();
  return Ti = (p, c, f) => new t(p, f).compare(new t(c, f)), Ti;
}
var Si, _s;
function Sf() {
  if (_s) return Si;
  _s = 1;
  const t = Ze();
  return Si = (p, c, f) => t(c, p, f), Si;
}
var Ci, Rs;
function Cf() {
  if (Rs) return Ci;
  Rs = 1;
  const t = Ze();
  return Ci = (p, c) => t(p, c, !0), Ci;
}
var bi, As;
function da() {
  if (As) return bi;
  As = 1;
  const t = Be();
  return bi = (p, c, f) => {
    const u = new t(p, f), a = new t(c, f);
    return u.compare(a) || u.compareBuild(a);
  }, bi;
}
var Pi, Ts;
function bf() {
  if (Ts) return Pi;
  Ts = 1;
  const t = da();
  return Pi = (p, c) => p.sort((f, u) => t(f, u, c)), Pi;
}
var Oi, Ss;
function Pf() {
  if (Ss) return Oi;
  Ss = 1;
  const t = da();
  return Oi = (p, c) => p.sort((f, u) => t(u, f, c)), Oi;
}
var Ii, Cs;
function Kr() {
  if (Cs) return Ii;
  Cs = 1;
  const t = Ze();
  return Ii = (p, c, f) => t(p, c, f) > 0, Ii;
}
var Di, bs;
function ha() {
  if (bs) return Di;
  bs = 1;
  const t = Ze();
  return Di = (p, c, f) => t(p, c, f) < 0, Di;
}
var Ni, Ps;
function lu() {
  if (Ps) return Ni;
  Ps = 1;
  const t = Ze();
  return Ni = (p, c, f) => t(p, c, f) === 0, Ni;
}
var Fi, Os;
function uu() {
  if (Os) return Fi;
  Os = 1;
  const t = Ze();
  return Fi = (p, c, f) => t(p, c, f) !== 0, Fi;
}
var Li, Is;
function pa() {
  if (Is) return Li;
  Is = 1;
  const t = Ze();
  return Li = (p, c, f) => t(p, c, f) >= 0, Li;
}
var xi, Ds;
function ma() {
  if (Ds) return xi;
  Ds = 1;
  const t = Ze();
  return xi = (p, c, f) => t(p, c, f) <= 0, xi;
}
var Ui, Ns;
function cu() {
  if (Ns) return Ui;
  Ns = 1;
  const t = lu(), d = uu(), p = Kr(), c = pa(), f = ha(), u = ma();
  return Ui = (l, o, s, i) => {
    switch (o) {
      case "===":
        return typeof l == "object" && (l = l.version), typeof s == "object" && (s = s.version), l === s;
      case "!==":
        return typeof l == "object" && (l = l.version), typeof s == "object" && (s = s.version), l !== s;
      case "":
      case "=":
      case "==":
        return t(l, s, i);
      case "!=":
        return d(l, s, i);
      case ">":
        return p(l, s, i);
      case ">=":
        return c(l, s, i);
      case "<":
        return f(l, s, i);
      case "<=":
        return u(l, s, i);
      default:
        throw new TypeError(`Invalid operator: ${o}`);
    }
  }, Ui;
}
var ki, Fs;
function Of() {
  if (Fs) return ki;
  Fs = 1;
  const t = Be(), d = jt(), { safeRe: p, t: c } = _r();
  return ki = (u, a) => {
    if (u instanceof t)
      return u;
    if (typeof u == "number" && (u = String(u)), typeof u != "string")
      return null;
    a = a || {};
    let l = null;
    if (!a.rtl)
      l = u.match(a.includePrerelease ? p[c.COERCEFULL] : p[c.COERCE]);
    else {
      const h = a.includePrerelease ? p[c.COERCERTLFULL] : p[c.COERCERTL];
      let g;
      for (; (g = h.exec(u)) && (!l || l.index + l[0].length !== u.length); )
        (!l || g.index + g[0].length !== l.index + l[0].length) && (l = g), h.lastIndex = g.index + g[1].length + g[2].length;
      h.lastIndex = -1;
    }
    if (l === null)
      return null;
    const o = l[2], s = l[3] || "0", i = l[4] || "0", r = a.includePrerelease && l[5] ? `-${l[5]}` : "", n = a.includePrerelease && l[6] ? `+${l[6]}` : "";
    return d(`${o}.${s}.${i}${r}${n}`, a);
  }, ki;
}
var qi, Ls;
function If() {
  if (Ls) return qi;
  Ls = 1;
  class t {
    constructor() {
      this.max = 1e3, this.map = /* @__PURE__ */ new Map();
    }
    get(p) {
      const c = this.map.get(p);
      if (c !== void 0)
        return this.map.delete(p), this.map.set(p, c), c;
    }
    delete(p) {
      return this.map.delete(p);
    }
    set(p, c) {
      if (!this.delete(p) && c !== void 0) {
        if (this.map.size >= this.max) {
          const u = this.map.keys().next().value;
          this.delete(u);
        }
        this.map.set(p, c);
      }
      return this;
    }
  }
  return qi = t, qi;
}
var $i, xs;
function et() {
  if (xs) return $i;
  xs = 1;
  const t = /\s+/g;
  class d {
    constructor(N, j) {
      if (j = f(j), N instanceof d)
        return N.loose === !!j.loose && N.includePrerelease === !!j.includePrerelease ? N : new d(N.raw, j);
      if (N instanceof u)
        return this.raw = N.value, this.set = [[N]], this.formatted = void 0, this;
      if (this.options = j, this.loose = !!j.loose, this.includePrerelease = !!j.includePrerelease, this.raw = N.trim().replace(t, " "), this.set = this.raw.split("||").map((D) => this.parseRange(D.trim())).filter((D) => D.length), !this.set.length)
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      if (this.set.length > 1) {
        const D = this.set[0];
        if (this.set = this.set.filter((G) => !y(G[0])), this.set.length === 0)
          this.set = [D];
        else if (this.set.length > 1) {
          for (const G of this.set)
            if (G.length === 1 && m(G[0])) {
              this.set = [G];
              break;
            }
        }
      }
      this.formatted = void 0;
    }
    get range() {
      if (this.formatted === void 0) {
        this.formatted = "";
        for (let N = 0; N < this.set.length; N++) {
          N > 0 && (this.formatted += "||");
          const j = this.set[N];
          for (let D = 0; D < j.length; D++)
            D > 0 && (this.formatted += " "), this.formatted += j[D].toString().trim();
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(N) {
      const D = ((this.options.includePrerelease && h) | (this.options.loose && g)) + ":" + N, G = c.get(D);
      if (G)
        return G;
      const V = this.options.loose, te = V ? o[s.HYPHENRANGELOOSE] : o[s.HYPHENRANGE];
      N = N.replace(te, x(this.options.includePrerelease)), a("hyphen replace", N), N = N.replace(o[s.COMPARATORTRIM], i), a("comparator trim", N), N = N.replace(o[s.TILDETRIM], r), a("tilde trim", N), N = N.replace(o[s.CARETTRIM], n), a("caret trim", N);
      let de = N.split(" ").map((Q) => T(Q, this.options)).join(" ").split(/\s+/).map((Q) => q(Q, this.options));
      V && (de = de.filter((Q) => (a("loose invalid filter", Q, this.options), !!Q.match(o[s.COMPARATORLOOSE])))), a("range list", de);
      const ie = /* @__PURE__ */ new Map(), we = de.map((Q) => new u(Q, this.options));
      for (const Q of we) {
        if (y(Q))
          return [Q];
        ie.set(Q.value, Q);
      }
      ie.size > 1 && ie.has("") && ie.delete("");
      const ve = [...ie.values()];
      return c.set(D, ve), ve;
    }
    intersects(N, j) {
      if (!(N instanceof d))
        throw new TypeError("a Range is required");
      return this.set.some((D) => _(D, j) && N.set.some((G) => _(G, j) && D.every((V) => G.every((te) => V.intersects(te, j)))));
    }
    // if ANY of the sets match ALL of its comparators, then pass
    test(N) {
      if (!N)
        return !1;
      if (typeof N == "string")
        try {
          N = new l(N, this.options);
        } catch {
          return !1;
        }
      for (let j = 0; j < this.set.length; j++)
        if ($(this.set[j], N, this.options))
          return !0;
      return !1;
    }
  }
  $i = d;
  const p = If(), c = new p(), f = fa(), u = Jr(), a = Xr(), l = Be(), {
    safeRe: o,
    t: s,
    comparatorTrimReplace: i,
    tildeTrimReplace: r,
    caretTrimReplace: n
  } = _r(), { FLAG_INCLUDE_PRERELEASE: h, FLAG_LOOSE: g } = zr(), y = (L) => L.value === "<0.0.0-0", m = (L) => L.value === "", _ = (L, N) => {
    let j = !0;
    const D = L.slice();
    let G = D.pop();
    for (; j && D.length; )
      j = D.every((V) => G.intersects(V, N)), G = D.pop();
    return j;
  }, T = (L, N) => (L = L.replace(o[s.BUILD], ""), a("comp", L, N), L = I(L, N), a("caret", L), L = O(L, N), a("tildes", L), L = A(L, N), a("xrange", L), L = k(L, N), a("stars", L), L), P = (L) => !L || L.toLowerCase() === "x" || L === "*", O = (L, N) => L.trim().split(/\s+/).map((j) => b(j, N)).join(" "), b = (L, N) => {
    const j = N.loose ? o[s.TILDELOOSE] : o[s.TILDE];
    return L.replace(j, (D, G, V, te, de) => {
      a("tilde", L, D, G, V, te, de);
      let ie;
      return P(G) ? ie = "" : P(V) ? ie = `>=${G}.0.0 <${+G + 1}.0.0-0` : P(te) ? ie = `>=${G}.${V}.0 <${G}.${+V + 1}.0-0` : de ? (a("replaceTilde pr", de), ie = `>=${G}.${V}.${te}-${de} <${G}.${+V + 1}.0-0`) : ie = `>=${G}.${V}.${te} <${G}.${+V + 1}.0-0`, a("tilde return", ie), ie;
    });
  }, I = (L, N) => L.trim().split(/\s+/).map((j) => S(j, N)).join(" "), S = (L, N) => {
    a("caret", L, N);
    const j = N.loose ? o[s.CARETLOOSE] : o[s.CARET], D = N.includePrerelease ? "-0" : "";
    return L.replace(j, (G, V, te, de, ie) => {
      a("caret", L, G, V, te, de, ie);
      let we;
      return P(V) ? we = "" : P(te) ? we = `>=${V}.0.0${D} <${+V + 1}.0.0-0` : P(de) ? V === "0" ? we = `>=${V}.${te}.0${D} <${V}.${+te + 1}.0-0` : we = `>=${V}.${te}.0${D} <${+V + 1}.0.0-0` : ie ? (a("replaceCaret pr", ie), V === "0" ? te === "0" ? we = `>=${V}.${te}.${de}-${ie} <${V}.${te}.${+de + 1}-0` : we = `>=${V}.${te}.${de}-${ie} <${V}.${+te + 1}.0-0` : we = `>=${V}.${te}.${de}-${ie} <${+V + 1}.0.0-0`) : (a("no pr"), V === "0" ? te === "0" ? we = `>=${V}.${te}.${de}${D} <${V}.${te}.${+de + 1}-0` : we = `>=${V}.${te}.${de}${D} <${V}.${+te + 1}.0-0` : we = `>=${V}.${te}.${de} <${+V + 1}.0.0-0`), a("caret return", we), we;
    });
  }, A = (L, N) => (a("replaceXRanges", L, N), L.split(/\s+/).map((j) => v(j, N)).join(" ")), v = (L, N) => {
    L = L.trim();
    const j = N.loose ? o[s.XRANGELOOSE] : o[s.XRANGE];
    return L.replace(j, (D, G, V, te, de, ie) => {
      a("xRange", L, D, G, V, te, de, ie);
      const we = P(V), ve = we || P(te), Q = ve || P(de), ge = Q;
      return G === "=" && ge && (G = ""), ie = N.includePrerelease ? "-0" : "", we ? G === ">" || G === "<" ? D = "<0.0.0-0" : D = "*" : G && ge ? (ve && (te = 0), de = 0, G === ">" ? (G = ">=", ve ? (V = +V + 1, te = 0, de = 0) : (te = +te + 1, de = 0)) : G === "<=" && (G = "<", ve ? V = +V + 1 : te = +te + 1), G === "<" && (ie = "-0"), D = `${G + V}.${te}.${de}${ie}`) : ve ? D = `>=${V}.0.0${ie} <${+V + 1}.0.0-0` : Q && (D = `>=${V}.${te}.0${ie} <${V}.${+te + 1}.0-0`), a("xRange return", D), D;
    });
  }, k = (L, N) => (a("replaceStars", L, N), L.trim().replace(o[s.STAR], "")), q = (L, N) => (a("replaceGTE0", L, N), L.trim().replace(o[N.includePrerelease ? s.GTE0PRE : s.GTE0], "")), x = (L) => (N, j, D, G, V, te, de, ie, we, ve, Q, ge) => (P(D) ? j = "" : P(G) ? j = `>=${D}.0.0${L ? "-0" : ""}` : P(V) ? j = `>=${D}.${G}.0${L ? "-0" : ""}` : te ? j = `>=${j}` : j = `>=${j}${L ? "-0" : ""}`, P(we) ? ie = "" : P(ve) ? ie = `<${+we + 1}.0.0-0` : P(Q) ? ie = `<${we}.${+ve + 1}.0-0` : ge ? ie = `<=${we}.${ve}.${Q}-${ge}` : L ? ie = `<${we}.${ve}.${+Q + 1}-0` : ie = `<=${ie}`, `${j} ${ie}`.trim()), $ = (L, N, j) => {
    for (let D = 0; D < L.length; D++)
      if (!L[D].test(N))
        return !1;
    if (N.prerelease.length && !j.includePrerelease) {
      for (let D = 0; D < L.length; D++)
        if (a(L[D].semver), L[D].semver !== u.ANY && L[D].semver.prerelease.length > 0) {
          const G = L[D].semver;
          if (G.major === N.major && G.minor === N.minor && G.patch === N.patch)
            return !0;
        }
      return !1;
    }
    return !0;
  };
  return $i;
}
var Mi, Us;
function Jr() {
  if (Us) return Mi;
  Us = 1;
  const t = /* @__PURE__ */ Symbol("SemVer ANY");
  class d {
    static get ANY() {
      return t;
    }
    constructor(i, r) {
      if (r = p(r), i instanceof d) {
        if (i.loose === !!r.loose)
          return i;
        i = i.value;
      }
      i = i.trim().split(/\s+/).join(" "), a("comparator", i, r), this.options = r, this.loose = !!r.loose, this.parse(i), this.semver === t ? this.value = "" : this.value = this.operator + this.semver.version, a("comp", this);
    }
    parse(i) {
      const r = this.options.loose ? c[f.COMPARATORLOOSE] : c[f.COMPARATOR], n = i.match(r);
      if (!n)
        throw new TypeError(`Invalid comparator: ${i}`);
      this.operator = n[1] !== void 0 ? n[1] : "", this.operator === "=" && (this.operator = ""), n[2] ? this.semver = new l(n[2], this.options.loose) : this.semver = t;
    }
    toString() {
      return this.value;
    }
    test(i) {
      if (a("Comparator.test", i, this.options.loose), this.semver === t || i === t)
        return !0;
      if (typeof i == "string")
        try {
          i = new l(i, this.options);
        } catch {
          return !1;
        }
      return u(i, this.operator, this.semver, this.options);
    }
    intersects(i, r) {
      if (!(i instanceof d))
        throw new TypeError("a Comparator is required");
      return this.operator === "" ? this.value === "" ? !0 : new o(i.value, r).test(this.value) : i.operator === "" ? i.value === "" ? !0 : new o(this.value, r).test(i.semver) : (r = p(r), r.includePrerelease && (this.value === "<0.0.0-0" || i.value === "<0.0.0-0") || !r.includePrerelease && (this.value.startsWith("<0.0.0") || i.value.startsWith("<0.0.0")) ? !1 : !!(this.operator.startsWith(">") && i.operator.startsWith(">") || this.operator.startsWith("<") && i.operator.startsWith("<") || this.semver.version === i.semver.version && this.operator.includes("=") && i.operator.includes("=") || u(this.semver, "<", i.semver, r) && this.operator.startsWith(">") && i.operator.startsWith("<") || u(this.semver, ">", i.semver, r) && this.operator.startsWith("<") && i.operator.startsWith(">")));
    }
  }
  Mi = d;
  const p = fa(), { safeRe: c, t: f } = _r(), u = cu(), a = Xr(), l = Be(), o = et();
  return Mi;
}
var Bi, ks;
function Qr() {
  if (ks) return Bi;
  ks = 1;
  const t = et();
  return Bi = (p, c, f) => {
    try {
      c = new t(c, f);
    } catch {
      return !1;
    }
    return c.test(p);
  }, Bi;
}
var Hi, qs;
function Df() {
  if (qs) return Hi;
  qs = 1;
  const t = et();
  return Hi = (p, c) => new t(p, c).set.map((f) => f.map((u) => u.value).join(" ").trim().split(" ")), Hi;
}
var ji, $s;
function Nf() {
  if ($s) return ji;
  $s = 1;
  const t = Be(), d = et();
  return ji = (c, f, u) => {
    let a = null, l = null, o = null;
    try {
      o = new d(f, u);
    } catch {
      return null;
    }
    return c.forEach((s) => {
      o.test(s) && (!a || l.compare(s) === -1) && (a = s, l = new t(a, u));
    }), a;
  }, ji;
}
var Gi, Ms;
function Ff() {
  if (Ms) return Gi;
  Ms = 1;
  const t = Be(), d = et();
  return Gi = (c, f, u) => {
    let a = null, l = null, o = null;
    try {
      o = new d(f, u);
    } catch {
      return null;
    }
    return c.forEach((s) => {
      o.test(s) && (!a || l.compare(s) === 1) && (a = s, l = new t(a, u));
    }), a;
  }, Gi;
}
var Wi, Bs;
function Lf() {
  if (Bs) return Wi;
  Bs = 1;
  const t = Be(), d = et(), p = Kr();
  return Wi = (f, u) => {
    f = new d(f, u);
    let a = new t("0.0.0");
    if (f.test(a) || (a = new t("0.0.0-0"), f.test(a)))
      return a;
    a = null;
    for (let l = 0; l < f.set.length; ++l) {
      const o = f.set[l];
      let s = null;
      o.forEach((i) => {
        const r = new t(i.semver.version);
        switch (i.operator) {
          case ">":
            r.prerelease.length === 0 ? r.patch++ : r.prerelease.push(0), r.raw = r.format();
          /* fallthrough */
          case "":
          case ">=":
            (!s || p(r, s)) && (s = r);
            break;
          case "<":
          case "<=":
            break;
          /* istanbul ignore next */
          default:
            throw new Error(`Unexpected operation: ${i.operator}`);
        }
      }), s && (!a || p(a, s)) && (a = s);
    }
    return a && f.test(a) ? a : null;
  }, Wi;
}
var Vi, Hs;
function xf() {
  if (Hs) return Vi;
  Hs = 1;
  const t = et();
  return Vi = (p, c) => {
    try {
      return new t(p, c).range || "*";
    } catch {
      return null;
    }
  }, Vi;
}
var Yi, js;
function ga() {
  if (js) return Yi;
  js = 1;
  const t = Be(), d = Jr(), { ANY: p } = d, c = et(), f = Qr(), u = Kr(), a = ha(), l = ma(), o = pa();
  return Yi = (i, r, n, h) => {
    i = new t(i, h), r = new c(r, h);
    let g, y, m, _, T;
    switch (n) {
      case ">":
        g = u, y = l, m = a, _ = ">", T = ">=";
        break;
      case "<":
        g = a, y = o, m = u, _ = "<", T = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (f(i, r, h))
      return !1;
    for (let P = 0; P < r.set.length; ++P) {
      const O = r.set[P];
      let b = null, I = null;
      if (O.forEach((S) => {
        S.semver === p && (S = new d(">=0.0.0")), b = b || S, I = I || S, g(S.semver, b.semver, h) ? b = S : m(S.semver, I.semver, h) && (I = S);
      }), b.operator === _ || b.operator === T || (!I.operator || I.operator === _) && y(i, I.semver))
        return !1;
      if (I.operator === T && m(i, I.semver))
        return !1;
    }
    return !0;
  }, Yi;
}
var zi, Gs;
function Uf() {
  if (Gs) return zi;
  Gs = 1;
  const t = ga();
  return zi = (p, c, f) => t(p, c, ">", f), zi;
}
var Xi, Ws;
function kf() {
  if (Ws) return Xi;
  Ws = 1;
  const t = ga();
  return Xi = (p, c, f) => t(p, c, "<", f), Xi;
}
var Ki, Vs;
function qf() {
  if (Vs) return Ki;
  Vs = 1;
  const t = et();
  return Ki = (p, c, f) => (p = new t(p, f), c = new t(c, f), p.intersects(c, f)), Ki;
}
var Ji, Ys;
function $f() {
  if (Ys) return Ji;
  Ys = 1;
  const t = Qr(), d = Ze();
  return Ji = (p, c, f) => {
    const u = [];
    let a = null, l = null;
    const o = p.sort((n, h) => d(n, h, f));
    for (const n of o)
      t(n, c, f) ? (l = n, a || (a = n)) : (l && u.push([a, l]), l = null, a = null);
    a && u.push([a, null]);
    const s = [];
    for (const [n, h] of u)
      n === h ? s.push(n) : !h && n === o[0] ? s.push("*") : h ? n === o[0] ? s.push(`<=${h}`) : s.push(`${n} - ${h}`) : s.push(`>=${n}`);
    const i = s.join(" || "), r = typeof c.raw == "string" ? c.raw : String(c);
    return i.length < r.length ? i : c;
  }, Ji;
}
var Qi, zs;
function Mf() {
  if (zs) return Qi;
  zs = 1;
  const t = et(), d = Jr(), { ANY: p } = d, c = Qr(), f = Ze(), u = (r, n, h = {}) => {
    if (r === n)
      return !0;
    r = new t(r, h), n = new t(n, h);
    let g = !1;
    e: for (const y of r.set) {
      for (const m of n.set) {
        const _ = o(y, m, h);
        if (g = g || _ !== null, _)
          continue e;
      }
      if (g)
        return !1;
    }
    return !0;
  }, a = [new d(">=0.0.0-0")], l = [new d(">=0.0.0")], o = (r, n, h) => {
    if (r === n)
      return !0;
    if (r.length === 1 && r[0].semver === p) {
      if (n.length === 1 && n[0].semver === p)
        return !0;
      h.includePrerelease ? r = a : r = l;
    }
    if (n.length === 1 && n[0].semver === p) {
      if (h.includePrerelease)
        return !0;
      n = l;
    }
    const g = /* @__PURE__ */ new Set();
    let y, m;
    for (const A of r)
      A.operator === ">" || A.operator === ">=" ? y = s(y, A, h) : A.operator === "<" || A.operator === "<=" ? m = i(m, A, h) : g.add(A.semver);
    if (g.size > 1)
      return null;
    let _;
    if (y && m) {
      if (_ = f(y.semver, m.semver, h), _ > 0)
        return null;
      if (_ === 0 && (y.operator !== ">=" || m.operator !== "<="))
        return null;
    }
    for (const A of g) {
      if (y && !c(A, String(y), h) || m && !c(A, String(m), h))
        return null;
      for (const v of n)
        if (!c(A, String(v), h))
          return !1;
      return !0;
    }
    let T, P, O, b, I = m && !h.includePrerelease && m.semver.prerelease.length ? m.semver : !1, S = y && !h.includePrerelease && y.semver.prerelease.length ? y.semver : !1;
    I && I.prerelease.length === 1 && m.operator === "<" && I.prerelease[0] === 0 && (I = !1);
    for (const A of n) {
      if (b = b || A.operator === ">" || A.operator === ">=", O = O || A.operator === "<" || A.operator === "<=", y) {
        if (S && A.semver.prerelease && A.semver.prerelease.length && A.semver.major === S.major && A.semver.minor === S.minor && A.semver.patch === S.patch && (S = !1), A.operator === ">" || A.operator === ">=") {
          if (T = s(y, A, h), T === A && T !== y)
            return !1;
        } else if (y.operator === ">=" && !c(y.semver, String(A), h))
          return !1;
      }
      if (m) {
        if (I && A.semver.prerelease && A.semver.prerelease.length && A.semver.major === I.major && A.semver.minor === I.minor && A.semver.patch === I.patch && (I = !1), A.operator === "<" || A.operator === "<=") {
          if (P = i(m, A, h), P === A && P !== m)
            return !1;
        } else if (m.operator === "<=" && !c(m.semver, String(A), h))
          return !1;
      }
      if (!A.operator && (m || y) && _ !== 0)
        return !1;
    }
    return !(y && O && !m && _ !== 0 || m && b && !y && _ !== 0 || S || I);
  }, s = (r, n, h) => {
    if (!r)
      return n;
    const g = f(r.semver, n.semver, h);
    return g > 0 ? r : g < 0 || n.operator === ">" && r.operator === ">=" ? n : r;
  }, i = (r, n, h) => {
    if (!r)
      return n;
    const g = f(r.semver, n.semver, h);
    return g < 0 ? r : g > 0 || n.operator === "<" && r.operator === "<=" ? n : r;
  };
  return Qi = u, Qi;
}
var Zi, Xs;
function fu() {
  if (Xs) return Zi;
  Xs = 1;
  const t = _r(), d = zr(), p = Be(), c = su(), f = jt(), u = vf(), a = Ef(), l = yf(), o = wf(), s = _f(), i = Rf(), r = Af(), n = Tf(), h = Ze(), g = Sf(), y = Cf(), m = da(), _ = bf(), T = Pf(), P = Kr(), O = ha(), b = lu(), I = uu(), S = pa(), A = ma(), v = cu(), k = Of(), q = Jr(), x = et(), $ = Qr(), L = Df(), N = Nf(), j = Ff(), D = Lf(), G = xf(), V = ga(), te = Uf(), de = kf(), ie = qf(), we = $f(), ve = Mf();
  return Zi = {
    parse: f,
    valid: u,
    clean: a,
    inc: l,
    diff: o,
    major: s,
    minor: i,
    patch: r,
    prerelease: n,
    compare: h,
    rcompare: g,
    compareLoose: y,
    compareBuild: m,
    sort: _,
    rsort: T,
    gt: P,
    lt: O,
    eq: b,
    neq: I,
    gte: S,
    lte: A,
    cmp: v,
    coerce: k,
    Comparator: q,
    Range: x,
    satisfies: $,
    toComparators: L,
    maxSatisfying: N,
    minSatisfying: j,
    minVersion: D,
    validRange: G,
    outside: V,
    gtr: te,
    ltr: de,
    intersects: ie,
    simplifyRange: we,
    subset: ve,
    SemVer: p,
    re: t.re,
    src: t.src,
    tokens: t.t,
    SEMVER_SPEC_VERSION: d.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: d.RELEASE_TYPES,
    compareIdentifiers: c.compareIdentifiers,
    rcompareIdentifiers: c.rcompareIdentifiers
  }, Zi;
}
var Ut = {}, mr = { exports: {} };
mr.exports;
var Ks;
function Bf() {
  return Ks || (Ks = 1, (function(t, d) {
    var p = 200, c = "__lodash_hash_undefined__", f = 1, u = 2, a = 9007199254740991, l = "[object Arguments]", o = "[object Array]", s = "[object AsyncFunction]", i = "[object Boolean]", r = "[object Date]", n = "[object Error]", h = "[object Function]", g = "[object GeneratorFunction]", y = "[object Map]", m = "[object Number]", _ = "[object Null]", T = "[object Object]", P = "[object Promise]", O = "[object Proxy]", b = "[object RegExp]", I = "[object Set]", S = "[object String]", A = "[object Symbol]", v = "[object Undefined]", k = "[object WeakMap]", q = "[object ArrayBuffer]", x = "[object DataView]", $ = "[object Float32Array]", L = "[object Float64Array]", N = "[object Int8Array]", j = "[object Int16Array]", D = "[object Int32Array]", G = "[object Uint8Array]", V = "[object Uint8ClampedArray]", te = "[object Uint16Array]", de = "[object Uint32Array]", ie = /[\\^$.*+?()[\]{}|]/g, we = /^\[object .+?Constructor\]$/, ve = /^(?:0|[1-9]\d*)$/, Q = {};
    Q[$] = Q[L] = Q[N] = Q[j] = Q[D] = Q[G] = Q[V] = Q[te] = Q[de] = !0, Q[l] = Q[o] = Q[q] = Q[i] = Q[x] = Q[r] = Q[n] = Q[h] = Q[y] = Q[m] = Q[T] = Q[b] = Q[I] = Q[S] = Q[k] = !1;
    var ge = typeof Qe == "object" && Qe && Qe.Object === Object && Qe, w = typeof self == "object" && self && self.Object === Object && self, E = ge || w || Function("return this")(), H = d && !d.nodeType && d, F = H && !0 && t && !t.nodeType && t, ce = F && F.exports === H, he = ce && ge.process, pe = (function() {
      try {
        return he && he.binding && he.binding("util");
      } catch {
      }
    })(), _e = pe && pe.isTypedArray;
    function Ee(C, U) {
      for (var J = -1, le = C == null ? 0 : C.length, Pe = 0, Re = []; ++J < le; ) {
        var Ne = C[J];
        U(Ne, J, C) && (Re[Pe++] = Ne);
      }
      return Re;
    }
    function He(C, U) {
      for (var J = -1, le = U.length, Pe = C.length; ++J < le; )
        C[Pe + J] = U[J];
      return C;
    }
    function Ae(C, U) {
      for (var J = -1, le = C == null ? 0 : C.length; ++J < le; )
        if (U(C[J], J, C))
          return !0;
      return !1;
    }
    function $e(C, U) {
      for (var J = -1, le = Array(C); ++J < C; )
        le[J] = U(J);
      return le;
    }
    function lt(C) {
      return function(U) {
        return C(U);
      };
    }
    function nt(C, U) {
      return C.has(U);
    }
    function tt(C, U) {
      return C?.[U];
    }
    function e(C) {
      var U = -1, J = Array(C.size);
      return C.forEach(function(le, Pe) {
        J[++U] = [Pe, le];
      }), J;
    }
    function B(C, U) {
      return function(J) {
        return C(U(J));
      };
    }
    function W(C) {
      var U = -1, J = Array(C.size);
      return C.forEach(function(le) {
        J[++U] = le;
      }), J;
    }
    var ne = Array.prototype, Y = Function.prototype, re = Object.prototype, Z = E["__core-js_shared__"], oe = Y.toString, ue = re.hasOwnProperty, Te = (function() {
      var C = /[^.]+$/.exec(Z && Z.keys && Z.keys.IE_PROTO || "");
      return C ? "Symbol(src)_1." + C : "";
    })(), Se = re.toString, me = RegExp(
      "^" + oe.call(ue).replace(ie, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    ), R = ce ? E.Buffer : void 0, M = E.Symbol, z = E.Uint8Array, X = re.propertyIsEnumerable, K = ne.splice, ae = M ? M.toStringTag : void 0, ee = Object.getOwnPropertySymbols, se = R ? R.isBuffer : void 0, fe = B(Object.keys, Object), ye = Ft(E, "DataView"), be = Ft(E, "Map"), De = Ft(E, "Promise"), Ce = Ft(E, "Set"), Nt = Ft(E, "WeakMap"), Ke = Ft(Object, "create"), Et = _t(ye), Su = _t(be), Cu = _t(De), bu = _t(Ce), Pu = _t(Nt), _a = M ? M.prototype : void 0, tn = _a ? _a.valueOf : void 0;
    function yt(C) {
      var U = -1, J = C == null ? 0 : C.length;
      for (this.clear(); ++U < J; ) {
        var le = C[U];
        this.set(le[0], le[1]);
      }
    }
    function Ou() {
      this.__data__ = Ke ? Ke(null) : {}, this.size = 0;
    }
    function Iu(C) {
      var U = this.has(C) && delete this.__data__[C];
      return this.size -= U ? 1 : 0, U;
    }
    function Du(C) {
      var U = this.__data__;
      if (Ke) {
        var J = U[C];
        return J === c ? void 0 : J;
      }
      return ue.call(U, C) ? U[C] : void 0;
    }
    function Nu(C) {
      var U = this.__data__;
      return Ke ? U[C] !== void 0 : ue.call(U, C);
    }
    function Fu(C, U) {
      var J = this.__data__;
      return this.size += this.has(C) ? 0 : 1, J[C] = Ke && U === void 0 ? c : U, this;
    }
    yt.prototype.clear = Ou, yt.prototype.delete = Iu, yt.prototype.get = Du, yt.prototype.has = Nu, yt.prototype.set = Fu;
    function it(C) {
      var U = -1, J = C == null ? 0 : C.length;
      for (this.clear(); ++U < J; ) {
        var le = C[U];
        this.set(le[0], le[1]);
      }
    }
    function Lu() {
      this.__data__ = [], this.size = 0;
    }
    function xu(C) {
      var U = this.__data__, J = Ar(U, C);
      if (J < 0)
        return !1;
      var le = U.length - 1;
      return J == le ? U.pop() : K.call(U, J, 1), --this.size, !0;
    }
    function Uu(C) {
      var U = this.__data__, J = Ar(U, C);
      return J < 0 ? void 0 : U[J][1];
    }
    function ku(C) {
      return Ar(this.__data__, C) > -1;
    }
    function qu(C, U) {
      var J = this.__data__, le = Ar(J, C);
      return le < 0 ? (++this.size, J.push([C, U])) : J[le][1] = U, this;
    }
    it.prototype.clear = Lu, it.prototype.delete = xu, it.prototype.get = Uu, it.prototype.has = ku, it.prototype.set = qu;
    function wt(C) {
      var U = -1, J = C == null ? 0 : C.length;
      for (this.clear(); ++U < J; ) {
        var le = C[U];
        this.set(le[0], le[1]);
      }
    }
    function $u() {
      this.size = 0, this.__data__ = {
        hash: new yt(),
        map: new (be || it)(),
        string: new yt()
      };
    }
    function Mu(C) {
      var U = Tr(this, C).delete(C);
      return this.size -= U ? 1 : 0, U;
    }
    function Bu(C) {
      return Tr(this, C).get(C);
    }
    function Hu(C) {
      return Tr(this, C).has(C);
    }
    function ju(C, U) {
      var J = Tr(this, C), le = J.size;
      return J.set(C, U), this.size += J.size == le ? 0 : 1, this;
    }
    wt.prototype.clear = $u, wt.prototype.delete = Mu, wt.prototype.get = Bu, wt.prototype.has = Hu, wt.prototype.set = ju;
    function Rr(C) {
      var U = -1, J = C == null ? 0 : C.length;
      for (this.__data__ = new wt(); ++U < J; )
        this.add(C[U]);
    }
    function Gu(C) {
      return this.__data__.set(C, c), this;
    }
    function Wu(C) {
      return this.__data__.has(C);
    }
    Rr.prototype.add = Rr.prototype.push = Gu, Rr.prototype.has = Wu;
    function ut(C) {
      var U = this.__data__ = new it(C);
      this.size = U.size;
    }
    function Vu() {
      this.__data__ = new it(), this.size = 0;
    }
    function Yu(C) {
      var U = this.__data__, J = U.delete(C);
      return this.size = U.size, J;
    }
    function zu(C) {
      return this.__data__.get(C);
    }
    function Xu(C) {
      return this.__data__.has(C);
    }
    function Ku(C, U) {
      var J = this.__data__;
      if (J instanceof it) {
        var le = J.__data__;
        if (!be || le.length < p - 1)
          return le.push([C, U]), this.size = ++J.size, this;
        J = this.__data__ = new wt(le);
      }
      return J.set(C, U), this.size = J.size, this;
    }
    ut.prototype.clear = Vu, ut.prototype.delete = Yu, ut.prototype.get = zu, ut.prototype.has = Xu, ut.prototype.set = Ku;
    function Ju(C, U) {
      var J = Sr(C), le = !J && dc(C), Pe = !J && !le && rn(C), Re = !J && !le && !Pe && Ia(C), Ne = J || le || Pe || Re, Fe = Ne ? $e(C.length, String) : [], xe = Fe.length;
      for (var Oe in C)
        ue.call(C, Oe) && !(Ne && // Safari 9 has enumerable `arguments.length` in strict mode.
        (Oe == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
        Pe && (Oe == "offset" || Oe == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
        Re && (Oe == "buffer" || Oe == "byteLength" || Oe == "byteOffset") || // Skip index properties.
        sc(Oe, xe))) && Fe.push(Oe);
      return Fe;
    }
    function Ar(C, U) {
      for (var J = C.length; J--; )
        if (Ca(C[J][0], U))
          return J;
      return -1;
    }
    function Qu(C, U, J) {
      var le = U(C);
      return Sr(C) ? le : He(le, J(C));
    }
    function Gt(C) {
      return C == null ? C === void 0 ? v : _ : ae && ae in Object(C) ? ac(C) : fc(C);
    }
    function Ra(C) {
      return Wt(C) && Gt(C) == l;
    }
    function Aa(C, U, J, le, Pe) {
      return C === U ? !0 : C == null || U == null || !Wt(C) && !Wt(U) ? C !== C && U !== U : Zu(C, U, J, le, Aa, Pe);
    }
    function Zu(C, U, J, le, Pe, Re) {
      var Ne = Sr(C), Fe = Sr(U), xe = Ne ? o : ct(C), Oe = Fe ? o : ct(U);
      xe = xe == l ? T : xe, Oe = Oe == l ? T : Oe;
      var Ge = xe == T, Je = Oe == T, Ue = xe == Oe;
      if (Ue && rn(C)) {
        if (!rn(U))
          return !1;
        Ne = !0, Ge = !1;
      }
      if (Ue && !Ge)
        return Re || (Re = new ut()), Ne || Ia(C) ? Ta(C, U, J, le, Pe, Re) : nc(C, U, xe, J, le, Pe, Re);
      if (!(J & f)) {
        var Ye = Ge && ue.call(C, "__wrapped__"), ze = Je && ue.call(U, "__wrapped__");
        if (Ye || ze) {
          var ft = Ye ? C.value() : C, at = ze ? U.value() : U;
          return Re || (Re = new ut()), Pe(ft, at, J, le, Re);
        }
      }
      return Ue ? (Re || (Re = new ut()), ic(C, U, J, le, Pe, Re)) : !1;
    }
    function ec(C) {
      if (!Oa(C) || uc(C))
        return !1;
      var U = ba(C) ? me : we;
      return U.test(_t(C));
    }
    function tc(C) {
      return Wt(C) && Pa(C.length) && !!Q[Gt(C)];
    }
    function rc(C) {
      if (!cc(C))
        return fe(C);
      var U = [];
      for (var J in Object(C))
        ue.call(C, J) && J != "constructor" && U.push(J);
      return U;
    }
    function Ta(C, U, J, le, Pe, Re) {
      var Ne = J & f, Fe = C.length, xe = U.length;
      if (Fe != xe && !(Ne && xe > Fe))
        return !1;
      var Oe = Re.get(C);
      if (Oe && Re.get(U))
        return Oe == U;
      var Ge = -1, Je = !0, Ue = J & u ? new Rr() : void 0;
      for (Re.set(C, U), Re.set(U, C); ++Ge < Fe; ) {
        var Ye = C[Ge], ze = U[Ge];
        if (le)
          var ft = Ne ? le(ze, Ye, Ge, U, C, Re) : le(Ye, ze, Ge, C, U, Re);
        if (ft !== void 0) {
          if (ft)
            continue;
          Je = !1;
          break;
        }
        if (Ue) {
          if (!Ae(U, function(at, Rt) {
            if (!nt(Ue, Rt) && (Ye === at || Pe(Ye, at, J, le, Re)))
              return Ue.push(Rt);
          })) {
            Je = !1;
            break;
          }
        } else if (!(Ye === ze || Pe(Ye, ze, J, le, Re))) {
          Je = !1;
          break;
        }
      }
      return Re.delete(C), Re.delete(U), Je;
    }
    function nc(C, U, J, le, Pe, Re, Ne) {
      switch (J) {
        case x:
          if (C.byteLength != U.byteLength || C.byteOffset != U.byteOffset)
            return !1;
          C = C.buffer, U = U.buffer;
        case q:
          return !(C.byteLength != U.byteLength || !Re(new z(C), new z(U)));
        case i:
        case r:
        case m:
          return Ca(+C, +U);
        case n:
          return C.name == U.name && C.message == U.message;
        case b:
        case S:
          return C == U + "";
        case y:
          var Fe = e;
        case I:
          var xe = le & f;
          if (Fe || (Fe = W), C.size != U.size && !xe)
            return !1;
          var Oe = Ne.get(C);
          if (Oe)
            return Oe == U;
          le |= u, Ne.set(C, U);
          var Ge = Ta(Fe(C), Fe(U), le, Pe, Re, Ne);
          return Ne.delete(C), Ge;
        case A:
          if (tn)
            return tn.call(C) == tn.call(U);
      }
      return !1;
    }
    function ic(C, U, J, le, Pe, Re) {
      var Ne = J & f, Fe = Sa(C), xe = Fe.length, Oe = Sa(U), Ge = Oe.length;
      if (xe != Ge && !Ne)
        return !1;
      for (var Je = xe; Je--; ) {
        var Ue = Fe[Je];
        if (!(Ne ? Ue in U : ue.call(U, Ue)))
          return !1;
      }
      var Ye = Re.get(C);
      if (Ye && Re.get(U))
        return Ye == U;
      var ze = !0;
      Re.set(C, U), Re.set(U, C);
      for (var ft = Ne; ++Je < xe; ) {
        Ue = Fe[Je];
        var at = C[Ue], Rt = U[Ue];
        if (le)
          var Da = Ne ? le(Rt, at, Ue, U, C, Re) : le(at, Rt, Ue, C, U, Re);
        if (!(Da === void 0 ? at === Rt || Pe(at, Rt, J, le, Re) : Da)) {
          ze = !1;
          break;
        }
        ft || (ft = Ue == "constructor");
      }
      if (ze && !ft) {
        var Cr = C.constructor, br = U.constructor;
        Cr != br && "constructor" in C && "constructor" in U && !(typeof Cr == "function" && Cr instanceof Cr && typeof br == "function" && br instanceof br) && (ze = !1);
      }
      return Re.delete(C), Re.delete(U), ze;
    }
    function Sa(C) {
      return Qu(C, mc, oc);
    }
    function Tr(C, U) {
      var J = C.__data__;
      return lc(U) ? J[typeof U == "string" ? "string" : "hash"] : J.map;
    }
    function Ft(C, U) {
      var J = tt(C, U);
      return ec(J) ? J : void 0;
    }
    function ac(C) {
      var U = ue.call(C, ae), J = C[ae];
      try {
        C[ae] = void 0;
        var le = !0;
      } catch {
      }
      var Pe = Se.call(C);
      return le && (U ? C[ae] = J : delete C[ae]), Pe;
    }
    var oc = ee ? function(C) {
      return C == null ? [] : (C = Object(C), Ee(ee(C), function(U) {
        return X.call(C, U);
      }));
    } : gc, ct = Gt;
    (ye && ct(new ye(new ArrayBuffer(1))) != x || be && ct(new be()) != y || De && ct(De.resolve()) != P || Ce && ct(new Ce()) != I || Nt && ct(new Nt()) != k) && (ct = function(C) {
      var U = Gt(C), J = U == T ? C.constructor : void 0, le = J ? _t(J) : "";
      if (le)
        switch (le) {
          case Et:
            return x;
          case Su:
            return y;
          case Cu:
            return P;
          case bu:
            return I;
          case Pu:
            return k;
        }
      return U;
    });
    function sc(C, U) {
      return U = U ?? a, !!U && (typeof C == "number" || ve.test(C)) && C > -1 && C % 1 == 0 && C < U;
    }
    function lc(C) {
      var U = typeof C;
      return U == "string" || U == "number" || U == "symbol" || U == "boolean" ? C !== "__proto__" : C === null;
    }
    function uc(C) {
      return !!Te && Te in C;
    }
    function cc(C) {
      var U = C && C.constructor, J = typeof U == "function" && U.prototype || re;
      return C === J;
    }
    function fc(C) {
      return Se.call(C);
    }
    function _t(C) {
      if (C != null) {
        try {
          return oe.call(C);
        } catch {
        }
        try {
          return C + "";
        } catch {
        }
      }
      return "";
    }
    function Ca(C, U) {
      return C === U || C !== C && U !== U;
    }
    var dc = Ra(/* @__PURE__ */ (function() {
      return arguments;
    })()) ? Ra : function(C) {
      return Wt(C) && ue.call(C, "callee") && !X.call(C, "callee");
    }, Sr = Array.isArray;
    function hc(C) {
      return C != null && Pa(C.length) && !ba(C);
    }
    var rn = se || vc;
    function pc(C, U) {
      return Aa(C, U);
    }
    function ba(C) {
      if (!Oa(C))
        return !1;
      var U = Gt(C);
      return U == h || U == g || U == s || U == O;
    }
    function Pa(C) {
      return typeof C == "number" && C > -1 && C % 1 == 0 && C <= a;
    }
    function Oa(C) {
      var U = typeof C;
      return C != null && (U == "object" || U == "function");
    }
    function Wt(C) {
      return C != null && typeof C == "object";
    }
    var Ia = _e ? lt(_e) : tc;
    function mc(C) {
      return hc(C) ? Ju(C) : rc(C);
    }
    function gc() {
      return [];
    }
    function vc() {
      return !1;
    }
    t.exports = pc;
  })(mr, mr.exports)), mr.exports;
}
var Js;
function Hf() {
  if (Js) return Ut;
  Js = 1, Object.defineProperty(Ut, "__esModule", { value: !0 }), Ut.DownloadedUpdateHelper = void 0, Ut.createTempUpdateFile = l;
  const t = Er, d = mt, p = Bf(), c = /* @__PURE__ */ vt(), f = Ie;
  let u = class {
    constructor(s) {
      this.cacheDir = s, this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, this._downloadedFileInfo = null;
    }
    get downloadedFileInfo() {
      return this._downloadedFileInfo;
    }
    get file() {
      return this._file;
    }
    get packageFile() {
      return this._packageFile;
    }
    get cacheDirForPendingUpdate() {
      return f.join(this.cacheDir, "pending");
    }
    async validateDownloadedPath(s, i, r, n) {
      if (this.versionInfo != null && this.file === s && this.fileInfo != null)
        return p(this.versionInfo, i) && p(this.fileInfo.info, r.info) && await (0, c.pathExists)(s) ? s : null;
      const h = await this.getValidCachedUpdateFile(r, n);
      return h === null ? null : (n.info(`Update has already been downloaded to ${s}).`), this._file = h, h);
    }
    async setDownloadedFile(s, i, r, n, h, g) {
      this._file = s, this._packageFile = i, this.versionInfo = r, this.fileInfo = n, this._downloadedFileInfo = {
        fileName: h,
        sha512: n.info.sha512,
        isAdminRightsRequired: n.info.isAdminRightsRequired === !0
      }, g && await (0, c.outputJson)(this.getUpdateInfoFile(), this._downloadedFileInfo);
    }
    async clear() {
      this._file = null, this._packageFile = null, this.versionInfo = null, this.fileInfo = null, await this.cleanCacheDirForPendingUpdate();
    }
    async cleanCacheDirForPendingUpdate() {
      try {
        await (0, c.emptyDir)(this.cacheDirForPendingUpdate);
      } catch {
      }
    }
    /**
     * Returns "update-info.json" which is created in the update cache directory's "pending" subfolder after the first update is downloaded.  If the update file does not exist then the cache is cleared and recreated.  If the update file exists then its properties are validated.
     * @param fileInfo
     * @param logger
     */
    async getValidCachedUpdateFile(s, i) {
      const r = this.getUpdateInfoFile();
      if (!await (0, c.pathExists)(r))
        return null;
      let h;
      try {
        h = await (0, c.readJson)(r);
      } catch (_) {
        let T = "No cached update info available";
        return _.code !== "ENOENT" && (await this.cleanCacheDirForPendingUpdate(), T += ` (error on read: ${_.message})`), i.info(T), null;
      }
      if (!(h?.fileName !== null))
        return i.warn("Cached update info is corrupted: no fileName, directory for cached update will be cleaned"), await this.cleanCacheDirForPendingUpdate(), null;
      if (s.info.sha512 !== h.sha512)
        return i.info(`Cached update sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${h.sha512}, expected: ${s.info.sha512}. Directory for cached update will be cleaned`), await this.cleanCacheDirForPendingUpdate(), null;
      const y = f.join(this.cacheDirForPendingUpdate, h.fileName);
      if (!await (0, c.pathExists)(y))
        return i.info("Cached update file doesn't exist"), null;
      const m = await a(y);
      return s.info.sha512 !== m ? (i.warn(`Sha512 checksum doesn't match the latest available update. New update must be downloaded. Cached: ${m}, expected: ${s.info.sha512}`), await this.cleanCacheDirForPendingUpdate(), null) : (this._downloadedFileInfo = h, y);
    }
    getUpdateInfoFile() {
      return f.join(this.cacheDirForPendingUpdate, "update-info.json");
    }
  };
  Ut.DownloadedUpdateHelper = u;
  function a(o, s = "sha512", i = "base64", r) {
    return new Promise((n, h) => {
      const g = (0, t.createHash)(s);
      g.on("error", h).setEncoding(i), (0, d.createReadStream)(o, {
        ...r,
        highWaterMark: 1024 * 1024
        /* better to use more memory but hash faster */
      }).on("error", h).on("end", () => {
        g.end(), n(g.read());
      }).pipe(g, { end: !1 });
    });
  }
  async function l(o, s, i) {
    let r = 0, n = f.join(s, o);
    for (let h = 0; h < 3; h++)
      try {
        return await (0, c.unlink)(n), n;
      } catch (g) {
        if (g.code === "ENOENT")
          return n;
        i.warn(`Error on remove temp update file: ${g}`), n = f.join(s, `${r++}-${o}`);
      }
    return n;
  }
  return Ut;
}
var Kt = {}, $r = {}, Qs;
function jf() {
  if (Qs) return $r;
  Qs = 1, Object.defineProperty($r, "__esModule", { value: !0 }), $r.getAppCacheDir = p;
  const t = Ie, d = Gr;
  function p() {
    const c = (0, d.homedir)();
    let f;
    return process.platform === "win32" ? f = process.env.LOCALAPPDATA || t.join(c, "AppData", "Local") : process.platform === "darwin" ? f = t.join(c, "Library", "Caches") : f = process.env.XDG_CACHE_HOME || t.join(c, ".cache"), f;
  }
  return $r;
}
var Zs;
function Gf() {
  if (Zs) return Kt;
  Zs = 1, Object.defineProperty(Kt, "__esModule", { value: !0 }), Kt.ElectronAppAdapter = void 0;
  const t = Ie, d = jf();
  let p = class {
    constructor(f = bt.app) {
      this.app = f;
    }
    whenReady() {
      return this.app.whenReady();
    }
    get version() {
      return this.app.getVersion();
    }
    get name() {
      return this.app.getName();
    }
    get isPackaged() {
      return this.app.isPackaged === !0;
    }
    get appUpdateConfigPath() {
      return this.isPackaged ? t.join(process.resourcesPath, "app-update.yml") : t.join(this.app.getAppPath(), "dev-app-update.yml");
    }
    get userDataPath() {
      return this.app.getPath("userData");
    }
    get baseCachePath() {
      return (0, d.getAppCacheDir)();
    }
    quit() {
      this.app.quit();
    }
    relaunch() {
      this.app.relaunch();
    }
    onQuit(f) {
      this.app.once("quit", (u, a) => f(a));
    }
  };
  return Kt.ElectronAppAdapter = p, Kt;
}
var ea = {}, el;
function Wf() {
  return el || (el = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.ElectronHttpExecutor = t.NET_SESSION_NAME = void 0, t.getNetSession = p;
    const d = Le();
    t.NET_SESSION_NAME = "electron-updater";
    function p() {
      return bt.session.fromPartition(t.NET_SESSION_NAME, {
        cache: !1
      });
    }
    class c extends d.HttpExecutor {
      constructor(u) {
        super(), this.proxyLoginCallback = u, this.cachedSession = null;
      }
      async download(u, a, l) {
        return await l.cancellationToken.createPromise((o, s, i) => {
          const r = {
            headers: l.headers || void 0,
            redirect: "manual"
          };
          (0, d.configureRequestUrl)(u, r), (0, d.configureRequestOptions)(r), this.doDownload(r, {
            destination: a,
            options: l,
            onCancel: i,
            callback: (n) => {
              n == null ? o(a) : s(n);
            },
            responseHandler: null
          }, 0);
        });
      }
      createRequest(u, a) {
        u.headers && u.headers.Host && (u.host = u.headers.Host, delete u.headers.Host), this.cachedSession == null && (this.cachedSession = p());
        const l = bt.net.request({
          ...u,
          session: this.cachedSession
        });
        return l.on("response", a), this.proxyLoginCallback != null && l.on("login", this.proxyLoginCallback), l;
      }
      addRedirectHandlers(u, a, l, o, s) {
        u.on("redirect", (i, r, n) => {
          u.abort(), o > this.maxRedirects ? l(this.createMaxRedirectError()) : s(d.HttpExecutor.prepareRedirectUrlOptions(n, a));
        });
      }
    }
    t.ElectronHttpExecutor = c;
  })(ea)), ea;
}
var Jt = {}, kt = {}, tl;
function Ot() {
  if (tl) return kt;
  tl = 1, Object.defineProperty(kt, "__esModule", { value: !0 }), kt.newBaseUrl = d, kt.newUrlFromBase = p, kt.getChannelFilename = c;
  const t = gt;
  function d(f) {
    const u = new t.URL(f);
    return u.pathname.endsWith("/") || (u.pathname += "/"), u;
  }
  function p(f, u, a = !1) {
    const l = new t.URL(f, u), o = u.search;
    return o != null && o.length !== 0 ? l.search = o : a && (l.search = `noCache=${Date.now().toString(32)}`), l;
  }
  function c(f) {
    return `${f}.yml`;
  }
  return kt;
}
var ot = {}, ta, rl;
function du() {
  if (rl) return ta;
  rl = 1;
  var t = "[object Symbol]", d = /[\\^$.*+?()[\]{}|]/g, p = RegExp(d.source), c = typeof Qe == "object" && Qe && Qe.Object === Object && Qe, f = typeof self == "object" && self && self.Object === Object && self, u = c || f || Function("return this")(), a = Object.prototype, l = a.toString, o = u.Symbol, s = o ? o.prototype : void 0, i = s ? s.toString : void 0;
  function r(m) {
    if (typeof m == "string")
      return m;
    if (h(m))
      return i ? i.call(m) : "";
    var _ = m + "";
    return _ == "0" && 1 / m == -1 / 0 ? "-0" : _;
  }
  function n(m) {
    return !!m && typeof m == "object";
  }
  function h(m) {
    return typeof m == "symbol" || n(m) && l.call(m) == t;
  }
  function g(m) {
    return m == null ? "" : r(m);
  }
  function y(m) {
    return m = g(m), m && p.test(m) ? m.replace(d, "\\$&") : m;
  }
  return ta = y, ta;
}
var nl;
function Ve() {
  if (nl) return ot;
  nl = 1, Object.defineProperty(ot, "__esModule", { value: !0 }), ot.Provider = void 0, ot.findFile = a, ot.parseUpdateInfo = l, ot.getFileList = o, ot.resolveFiles = s;
  const t = Le(), d = ca(), p = gt, c = Ot(), f = du();
  let u = class {
    constructor(r) {
      this.runtimeOptions = r, this.requestHeaders = null, this.executor = r.executor;
    }
    // By default, the blockmap file is in the same directory as the main file
    // But some providers may have a different blockmap file, so we need to override this method
    getBlockMapFiles(r, n, h, g = null) {
      const y = (0, c.newUrlFromBase)(`${r.pathname}.blockmap`, r);
      return [(0, c.newUrlFromBase)(`${r.pathname.replace(new RegExp(f(h), "g"), n)}.blockmap`, g ? new p.URL(g) : r), y];
    }
    get isUseMultipleRangeRequest() {
      return this.runtimeOptions.isUseMultipleRangeRequest !== !1;
    }
    getChannelFilePrefix() {
      if (this.runtimeOptions.platform === "linux") {
        const r = process.env.TEST_UPDATER_ARCH || process.arch;
        return "-linux" + (r === "x64" ? "" : `-${r}`);
      } else
        return this.runtimeOptions.platform === "darwin" ? "-mac" : "";
    }
    // due to historical reasons for windows we use channel name without platform specifier
    getDefaultChannelName() {
      return this.getCustomChannelName("latest");
    }
    getCustomChannelName(r) {
      return `${r}${this.getChannelFilePrefix()}`;
    }
    get fileExtraDownloadHeaders() {
      return null;
    }
    setRequestHeaders(r) {
      this.requestHeaders = r;
    }
    /**
     * Method to perform API request only to resolve update info, but not to download update.
     */
    httpRequest(r, n, h) {
      return this.executor.request(this.createRequestOptions(r, n), h);
    }
    createRequestOptions(r, n) {
      const h = {};
      return this.requestHeaders == null ? n != null && (h.headers = n) : h.headers = n == null ? this.requestHeaders : { ...this.requestHeaders, ...n }, (0, t.configureRequestUrl)(r, h), h;
    }
  };
  ot.Provider = u;
  function a(i, r, n) {
    var h;
    if (i.length === 0)
      throw (0, t.newError)("No files provided", "ERR_UPDATER_NO_FILES_PROVIDED");
    const g = i.filter((m) => m.url.pathname.toLowerCase().endsWith(`.${r.toLowerCase()}`)), y = (h = g.find((m) => [m.url.pathname, m.info.url].some((_) => _.includes(process.arch)))) !== null && h !== void 0 ? h : g.shift();
    return y || (n == null ? i[0] : i.find((m) => !n.some((_) => m.url.pathname.toLowerCase().endsWith(`.${_.toLowerCase()}`))));
  }
  function l(i, r, n) {
    if (i == null)
      throw (0, t.newError)(`Cannot parse update info from ${r} in the latest release artifacts (${n}): rawData: null`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    let h;
    try {
      h = (0, d.load)(i);
    } catch (g) {
      throw (0, t.newError)(`Cannot parse update info from ${r} in the latest release artifacts (${n}): ${g.stack || g.message}, rawData: ${i}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
    }
    return h;
  }
  function o(i) {
    const r = i.files;
    if (r != null && r.length > 0)
      return r;
    if (i.path != null)
      return [
        {
          url: i.path,
          sha2: i.sha2,
          sha512: i.sha512
        }
      ];
    throw (0, t.newError)(`No files provided: ${(0, t.safeStringifyJson)(i)}`, "ERR_UPDATER_NO_FILES_PROVIDED");
  }
  function s(i, r, n = (h) => h) {
    const g = o(i).map((_) => {
      if (_.sha2 == null && _.sha512 == null)
        throw (0, t.newError)(`Update info doesn't contain nor sha256 neither sha512 checksum: ${(0, t.safeStringifyJson)(_)}`, "ERR_UPDATER_NO_CHECKSUM");
      return {
        url: (0, c.newUrlFromBase)(n(_.url), r),
        info: _
      };
    }), y = i.packages, m = y == null ? null : y[process.arch] || y.ia32;
    return m != null && (g[0].packageInfo = {
      ...m,
      path: (0, c.newUrlFromBase)(n(m.path), r).href
    }), g;
  }
  return ot;
}
var il;
function hu() {
  if (il) return Jt;
  il = 1, Object.defineProperty(Jt, "__esModule", { value: !0 }), Jt.GenericProvider = void 0;
  const t = Le(), d = Ot(), p = Ve();
  let c = class extends p.Provider {
    constructor(u, a, l) {
      super(l), this.configuration = u, this.updater = a, this.baseUrl = (0, d.newBaseUrl)(this.configuration.url);
    }
    get channel() {
      const u = this.updater.channel || this.configuration.channel;
      return u == null ? this.getDefaultChannelName() : this.getCustomChannelName(u);
    }
    async getLatestVersion() {
      const u = (0, d.getChannelFilename)(this.channel), a = (0, d.newUrlFromBase)(u, this.baseUrl, this.updater.isAddNoCacheQuery);
      for (let l = 0; ; l++)
        try {
          return (0, p.parseUpdateInfo)(await this.httpRequest(a), u, a);
        } catch (o) {
          if (o instanceof t.HttpError && o.statusCode === 404)
            throw (0, t.newError)(`Cannot find channel "${u}" update info: ${o.stack || o.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          if (o.code === "ECONNREFUSED" && l < 3) {
            await new Promise((s, i) => {
              try {
                setTimeout(s, 1e3 * l);
              } catch (r) {
                i(r);
              }
            });
            continue;
          }
          throw o;
        }
    }
    resolveFiles(u) {
      return (0, p.resolveFiles)(u, this.baseUrl);
    }
  };
  return Jt.GenericProvider = c, Jt;
}
var Qt = {}, Zt = {}, al;
function Vf() {
  if (al) return Zt;
  al = 1, Object.defineProperty(Zt, "__esModule", { value: !0 }), Zt.BitbucketProvider = void 0;
  const t = Le(), d = Ot(), p = Ve();
  let c = class extends p.Provider {
    constructor(u, a, l) {
      super({
        ...l,
        isUseMultipleRangeRequest: !1
      }), this.configuration = u, this.updater = a;
      const { owner: o, slug: s } = u;
      this.baseUrl = (0, d.newBaseUrl)(`https://api.bitbucket.org/2.0/repositories/${o}/${s}/downloads`);
    }
    get channel() {
      return this.updater.channel || this.configuration.channel || "latest";
    }
    async getLatestVersion() {
      const u = new t.CancellationToken(), a = (0, d.getChannelFilename)(this.getCustomChannelName(this.channel)), l = (0, d.newUrlFromBase)(a, this.baseUrl, this.updater.isAddNoCacheQuery);
      try {
        const o = await this.httpRequest(l, void 0, u);
        return (0, p.parseUpdateInfo)(o, a, l);
      } catch (o) {
        throw (0, t.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${o.stack || o.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    resolveFiles(u) {
      return (0, p.resolveFiles)(u, this.baseUrl);
    }
    toString() {
      const { owner: u, slug: a } = this.configuration;
      return `Bitbucket (owner: ${u}, slug: ${a}, channel: ${this.channel})`;
    }
  };
  return Zt.BitbucketProvider = c, Zt;
}
var ht = {}, ol;
function pu() {
  if (ol) return ht;
  ol = 1, Object.defineProperty(ht, "__esModule", { value: !0 }), ht.GitHubProvider = ht.BaseGitHubProvider = void 0, ht.computeReleaseNotes = s;
  const t = Le(), d = fu(), p = gt, c = Ot(), f = Ve(), u = /\/tag\/([^/]+)$/;
  class a extends f.Provider {
    constructor(r, n, h) {
      super({
        ...h,
        /* because GitHib uses S3 */
        isUseMultipleRangeRequest: !1
      }), this.options = r, this.baseUrl = (0, c.newBaseUrl)((0, t.githubUrl)(r, n));
      const g = n === "github.com" ? "api.github.com" : n;
      this.baseApiUrl = (0, c.newBaseUrl)((0, t.githubUrl)(r, g));
    }
    computeGithubBasePath(r) {
      const n = this.options.host;
      return n && !["github.com", "api.github.com"].includes(n) ? `/api/v3${r}` : r;
    }
  }
  ht.BaseGitHubProvider = a;
  let l = class extends a {
    constructor(r, n, h) {
      super(r, "github.com", h), this.options = r, this.updater = n;
    }
    get channel() {
      const r = this.updater.channel || this.options.channel;
      return r == null ? this.getDefaultChannelName() : this.getCustomChannelName(r);
    }
    async getLatestVersion() {
      var r, n, h, g, y;
      const m = new t.CancellationToken(), _ = await this.httpRequest((0, c.newUrlFromBase)(`${this.basePath}.atom`, this.baseUrl), {
        accept: "application/xml, application/atom+xml, text/xml, */*"
      }, m), T = (0, t.parseXml)(_);
      let P = T.element("entry", !1, "No published versions on GitHub"), O = null;
      try {
        if (this.updater.allowPrerelease) {
          const k = ((r = this.updater) === null || r === void 0 ? void 0 : r.channel) || ((n = d.prerelease(this.updater.currentVersion)) === null || n === void 0 ? void 0 : n[0]) || null;
          if (k === null)
            O = u.exec(P.element("link").attribute("href"))[1];
          else
            for (const q of T.getElements("entry")) {
              const x = u.exec(q.element("link").attribute("href"));
              if (x === null)
                continue;
              const $ = x[1], L = ((h = d.prerelease($)) === null || h === void 0 ? void 0 : h[0]) || null, N = !k || ["alpha", "beta"].includes(k), j = L !== null && !["alpha", "beta"].includes(String(L));
              if (N && !j && !(k === "beta" && L === "alpha")) {
                O = $;
                break;
              }
              if (L && L === k) {
                O = $;
                break;
              }
            }
        } else {
          O = await this.getLatestTagName(m);
          for (const k of T.getElements("entry"))
            if (u.exec(k.element("link").attribute("href"))[1] === O) {
              P = k;
              break;
            }
        }
      } catch (k) {
        throw (0, t.newError)(`Cannot parse releases feed: ${k.stack || k.message},
XML:
${_}`, "ERR_UPDATER_INVALID_RELEASE_FEED");
      }
      if (O == null)
        throw (0, t.newError)("No published versions on GitHub", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
      let b, I = "", S = "";
      const A = async (k) => {
        I = (0, c.getChannelFilename)(k), S = (0, c.newUrlFromBase)(this.getBaseDownloadPath(String(O), I), this.baseUrl);
        const q = this.createRequestOptions(S);
        try {
          return await this.executor.request(q, m);
        } catch (x) {
          throw x instanceof t.HttpError && x.statusCode === 404 ? (0, t.newError)(`Cannot find ${I} in the latest release artifacts (${S}): ${x.stack || x.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : x;
        }
      };
      try {
        let k = this.channel;
        this.updater.allowPrerelease && (!((g = d.prerelease(O)) === null || g === void 0) && g[0]) && (k = this.getCustomChannelName(String((y = d.prerelease(O)) === null || y === void 0 ? void 0 : y[0]))), b = await A(k);
      } catch (k) {
        if (this.updater.allowPrerelease)
          b = await A(this.getDefaultChannelName());
        else
          throw k;
      }
      const v = (0, f.parseUpdateInfo)(b, I, S);
      return v.releaseName == null && (v.releaseName = P.elementValueOrEmpty("title")), v.releaseNotes == null && (v.releaseNotes = s(this.updater.currentVersion, this.updater.fullChangelog, T, P)), {
        tag: O,
        ...v
      };
    }
    async getLatestTagName(r) {
      const n = this.options, h = n.host == null || n.host === "github.com" ? (0, c.newUrlFromBase)(`${this.basePath}/latest`, this.baseUrl) : new p.URL(`${this.computeGithubBasePath(`/repos/${n.owner}/${n.repo}/releases`)}/latest`, this.baseApiUrl);
      try {
        const g = await this.httpRequest(h, { Accept: "application/json" }, r);
        return g == null ? null : JSON.parse(g).tag_name;
      } catch (g) {
        throw (0, t.newError)(`Unable to find latest version on GitHub (${h}), please ensure a production release exists: ${g.stack || g.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    get basePath() {
      return `/${this.options.owner}/${this.options.repo}/releases`;
    }
    resolveFiles(r) {
      return (0, f.resolveFiles)(r, this.baseUrl, (n) => this.getBaseDownloadPath(r.tag, n.replace(/ /g, "-")));
    }
    getBaseDownloadPath(r, n) {
      return `${this.basePath}/download/${r}/${n}`;
    }
  };
  ht.GitHubProvider = l;
  function o(i) {
    const r = i.elementValueOrEmpty("content");
    return r === "No content." ? "" : r;
  }
  function s(i, r, n, h) {
    if (!r)
      return o(h);
    const g = [];
    for (const y of n.getElements("entry")) {
      const m = /\/tag\/v?([^/]+)$/.exec(y.element("link").attribute("href"))[1];
      d.valid(m) && d.lt(i, m) && g.push({
        version: m,
        note: o(y)
      });
    }
    return g.sort((y, m) => d.rcompare(y.version, m.version));
  }
  return ht;
}
var er = {}, sl;
function Yf() {
  if (sl) return er;
  sl = 1, Object.defineProperty(er, "__esModule", { value: !0 }), er.GitLabProvider = void 0;
  const t = Le(), d = gt, p = du(), c = Ot(), f = Ve();
  let u = class extends f.Provider {
    /**
     * Normalizes filenames by replacing spaces and underscores with dashes.
     *
     * This is a workaround to handle filename formatting differences between tools:
     * - electron-builder formats filenames like "test file.txt" as "test-file.txt"
     * - GitLab may provide asset URLs using underscores, such as "test_file.txt"
     *
     * Because of this mismatch, we can't reliably extract the correct filename from
     * the asset path without normalization. This function ensures consistent matching
     * across different filename formats by converting all spaces and underscores to dashes.
     *
     * @param filename The filename to normalize
     * @returns The normalized filename with spaces and underscores replaced by dashes
     */
    normalizeFilename(l) {
      return l.replace(/ |_/g, "-");
    }
    constructor(l, o, s) {
      super({
        ...s,
        // GitLab might not support multiple range requests efficiently
        isUseMultipleRangeRequest: !1
      }), this.options = l, this.updater = o, this.cachedLatestVersion = null;
      const r = l.host || "gitlab.com";
      this.baseApiUrl = (0, c.newBaseUrl)(`https://${r}/api/v4`);
    }
    get channel() {
      const l = this.updater.channel || this.options.channel;
      return l == null ? this.getDefaultChannelName() : this.getCustomChannelName(l);
    }
    async getLatestVersion() {
      const l = new t.CancellationToken(), o = (0, c.newUrlFromBase)(`projects/${this.options.projectId}/releases/permalink/latest`, this.baseApiUrl);
      let s;
      try {
        const T = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, P = await this.httpRequest(o, T, l);
        if (!P)
          throw (0, t.newError)("No latest release found", "ERR_UPDATER_NO_PUBLISHED_VERSIONS");
        s = JSON.parse(P);
      } catch (T) {
        throw (0, t.newError)(`Unable to find latest release on GitLab (${o}): ${T.stack || T.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
      const i = s.tag_name;
      let r = null, n = "", h = null;
      const g = async (T) => {
        n = (0, c.getChannelFilename)(T);
        const P = s.assets.links.find((b) => b.name === n);
        if (!P)
          throw (0, t.newError)(`Cannot find ${n} in the latest release assets`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
        h = new d.URL(P.direct_asset_url);
        const O = this.options.token ? { "PRIVATE-TOKEN": this.options.token } : void 0;
        try {
          const b = await this.httpRequest(h, O, l);
          if (!b)
            throw (0, t.newError)(`Empty response from ${h}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
          return b;
        } catch (b) {
          throw b instanceof t.HttpError && b.statusCode === 404 ? (0, t.newError)(`Cannot find ${n} in the latest release artifacts (${h}): ${b.stack || b.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : b;
        }
      };
      try {
        r = await g(this.channel);
      } catch (T) {
        if (this.channel !== this.getDefaultChannelName())
          r = await g(this.getDefaultChannelName());
        else
          throw T;
      }
      if (!r)
        throw (0, t.newError)(`Unable to parse channel data from ${n}`, "ERR_UPDATER_INVALID_UPDATE_INFO");
      const y = (0, f.parseUpdateInfo)(r, n, h);
      y.releaseName == null && (y.releaseName = s.name), y.releaseNotes == null && (y.releaseNotes = s.description || null);
      const m = /* @__PURE__ */ new Map();
      for (const T of s.assets.links)
        m.set(this.normalizeFilename(T.name), T.direct_asset_url);
      const _ = {
        tag: i,
        assets: m,
        ...y
      };
      return this.cachedLatestVersion = _, _;
    }
    /**
     * Utility function to convert GitlabReleaseAsset to Map<string, string>
     * Maps asset names to their download URLs
     */
    convertAssetsToMap(l) {
      const o = /* @__PURE__ */ new Map();
      for (const s of l.links)
        o.set(this.normalizeFilename(s.name), s.direct_asset_url);
      return o;
    }
    /**
     * Find blockmap file URL in assets map for a specific filename
     */
    findBlockMapInAssets(l, o) {
      const s = [`${o}.blockmap`, `${this.normalizeFilename(o)}.blockmap`];
      for (const i of s) {
        const r = l.get(i);
        if (r)
          return new d.URL(r);
      }
      return null;
    }
    async fetchReleaseInfoByVersion(l) {
      const o = new t.CancellationToken(), s = [`v${l}`, l];
      for (const i of s) {
        const r = (0, c.newUrlFromBase)(`projects/${this.options.projectId}/releases/${encodeURIComponent(i)}`, this.baseApiUrl);
        try {
          const n = { "Content-Type": "application/json", ...this.setAuthHeaderForToken(this.options.token || null) }, h = await this.httpRequest(r, n, o);
          if (h)
            return JSON.parse(h);
        } catch (n) {
          if (n instanceof t.HttpError && n.statusCode === 404)
            continue;
          throw (0, t.newError)(`Unable to find release ${i} on GitLab (${r}): ${n.stack || n.message}`, "ERR_UPDATER_RELEASE_NOT_FOUND");
        }
      }
      throw (0, t.newError)(`Unable to find release with version ${l} (tried: ${s.join(", ")}) on GitLab`, "ERR_UPDATER_RELEASE_NOT_FOUND");
    }
    setAuthHeaderForToken(l) {
      const o = {};
      return l != null && (l.startsWith("Bearer") ? o.authorization = l : o["PRIVATE-TOKEN"] = l), o;
    }
    /**
     * Get version info for blockmap files, using cache when possible
     */
    async getVersionInfoForBlockMap(l) {
      if (this.cachedLatestVersion && this.cachedLatestVersion.version === l)
        return this.cachedLatestVersion.assets;
      const o = await this.fetchReleaseInfoByVersion(l);
      return o && o.assets ? this.convertAssetsToMap(o.assets) : null;
    }
    /**
     * Find blockmap URLs from version assets
     */
    async findBlockMapUrlsFromAssets(l, o, s) {
      let i = null, r = null;
      const n = await this.getVersionInfoForBlockMap(o);
      n && (i = this.findBlockMapInAssets(n, s));
      const h = await this.getVersionInfoForBlockMap(l);
      if (h) {
        const g = s.replace(new RegExp(p(o), "g"), l);
        r = this.findBlockMapInAssets(h, g);
      }
      return [r, i];
    }
    async getBlockMapFiles(l, o, s, i = null) {
      if (this.options.uploadTarget === "project_upload") {
        const r = l.pathname.split("/").pop() || "", [n, h] = await this.findBlockMapUrlsFromAssets(o, s, r);
        if (!h)
          throw (0, t.newError)(`Cannot find blockmap file for ${s} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
        if (!n)
          throw (0, t.newError)(`Cannot find blockmap file for ${o} in GitLab assets`, "ERR_UPDATER_BLOCKMAP_FILE_NOT_FOUND");
        return [n, h];
      } else
        return super.getBlockMapFiles(l, o, s, i);
    }
    resolveFiles(l) {
      return (0, f.getFileList)(l).map((o) => {
        const i = [
          o.url,
          // Original filename
          this.normalizeFilename(o.url)
          // Normalized filename (spaces/underscores → dashes)
        ].find((n) => l.assets.has(n)), r = i ? l.assets.get(i) : void 0;
        if (!r)
          throw (0, t.newError)(`Cannot find asset "${o.url}" in GitLab release assets. Available assets: ${Array.from(l.assets.keys()).join(", ")}`, "ERR_UPDATER_ASSET_NOT_FOUND");
        return {
          url: new d.URL(r),
          info: o
        };
      });
    }
    toString() {
      return `GitLab (projectId: ${this.options.projectId}, channel: ${this.channel})`;
    }
  };
  return er.GitLabProvider = u, er;
}
var tr = {}, ll;
function zf() {
  if (ll) return tr;
  ll = 1, Object.defineProperty(tr, "__esModule", { value: !0 }), tr.KeygenProvider = void 0;
  const t = Le(), d = Ot(), p = Ve();
  let c = class extends p.Provider {
    constructor(u, a, l) {
      super({
        ...l,
        isUseMultipleRangeRequest: !1
      }), this.configuration = u, this.updater = a, this.defaultHostname = "api.keygen.sh";
      const o = this.configuration.host || this.defaultHostname;
      this.baseUrl = (0, d.newBaseUrl)(`https://${o}/v1/accounts/${this.configuration.account}/artifacts?product=${this.configuration.product}`);
    }
    get channel() {
      return this.updater.channel || this.configuration.channel || "stable";
    }
    async getLatestVersion() {
      const u = new t.CancellationToken(), a = (0, d.getChannelFilename)(this.getCustomChannelName(this.channel)), l = (0, d.newUrlFromBase)(a, this.baseUrl, this.updater.isAddNoCacheQuery);
      try {
        const o = await this.httpRequest(l, {
          Accept: "application/vnd.api+json",
          "Keygen-Version": "1.1"
        }, u);
        return (0, p.parseUpdateInfo)(o, a, l);
      } catch (o) {
        throw (0, t.newError)(`Unable to find latest version on ${this.toString()}, please ensure release exists: ${o.stack || o.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    resolveFiles(u) {
      return (0, p.resolveFiles)(u, this.baseUrl);
    }
    toString() {
      const { account: u, product: a, platform: l } = this.configuration;
      return `Keygen (account: ${u}, product: ${a}, platform: ${l}, channel: ${this.channel})`;
    }
  };
  return tr.KeygenProvider = c, tr;
}
var rr = {}, ul;
function Xf() {
  if (ul) return rr;
  ul = 1, Object.defineProperty(rr, "__esModule", { value: !0 }), rr.PrivateGitHubProvider = void 0;
  const t = Le(), d = ca(), p = Ie, c = gt, f = Ot(), u = pu(), a = Ve();
  let l = class extends u.BaseGitHubProvider {
    constructor(s, i, r, n) {
      super(s, "api.github.com", n), this.updater = i, this.token = r;
    }
    createRequestOptions(s, i) {
      const r = super.createRequestOptions(s, i);
      return r.redirect = "manual", r;
    }
    async getLatestVersion() {
      const s = new t.CancellationToken(), i = (0, f.getChannelFilename)(this.getDefaultChannelName()), r = await this.getLatestVersionInfo(s), n = r.assets.find((y) => y.name === i);
      if (n == null)
        throw (0, t.newError)(`Cannot find ${i} in the release ${r.html_url || r.name}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      const h = new c.URL(n.url);
      let g;
      try {
        g = (0, d.load)(await this.httpRequest(h, this.configureHeaders("application/octet-stream"), s));
      } catch (y) {
        throw y instanceof t.HttpError && y.statusCode === 404 ? (0, t.newError)(`Cannot find ${i} in the latest release artifacts (${h}): ${y.stack || y.message}`, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND") : y;
      }
      return g.assets = r.assets, g;
    }
    get fileExtraDownloadHeaders() {
      return this.configureHeaders("application/octet-stream");
    }
    configureHeaders(s) {
      return {
        accept: s,
        authorization: `token ${this.token}`
      };
    }
    async getLatestVersionInfo(s) {
      const i = this.updater.allowPrerelease;
      let r = this.basePath;
      i || (r = `${r}/latest`);
      const n = (0, f.newUrlFromBase)(r, this.baseUrl);
      try {
        const h = JSON.parse(await this.httpRequest(n, this.configureHeaders("application/vnd.github.v3+json"), s));
        return i ? h.find((g) => g.prerelease) || h[0] : h;
      } catch (h) {
        throw (0, t.newError)(`Unable to find latest version on GitHub (${n}), please ensure a production release exists: ${h.stack || h.message}`, "ERR_UPDATER_LATEST_VERSION_NOT_FOUND");
      }
    }
    get basePath() {
      return this.computeGithubBasePath(`/repos/${this.options.owner}/${this.options.repo}/releases`);
    }
    resolveFiles(s) {
      return (0, a.getFileList)(s).map((i) => {
        const r = p.posix.basename(i.url).replace(/ /g, "-"), n = s.assets.find((h) => h != null && h.name === r);
        if (n == null)
          throw (0, t.newError)(`Cannot find asset "${r}" in: ${JSON.stringify(s.assets, null, 2)}`, "ERR_UPDATER_ASSET_NOT_FOUND");
        return {
          url: new c.URL(n.url),
          info: i
        };
      });
    }
  };
  return rr.PrivateGitHubProvider = l, rr;
}
var cl;
function Kf() {
  if (cl) return Qt;
  cl = 1, Object.defineProperty(Qt, "__esModule", { value: !0 }), Qt.isUrlProbablySupportMultiRangeRequests = l, Qt.createClient = o;
  const t = Le(), d = Vf(), p = hu(), c = pu(), f = Yf(), u = zf(), a = Xf();
  function l(s) {
    return !s.includes("s3.amazonaws.com");
  }
  function o(s, i, r) {
    if (typeof s == "string")
      throw (0, t.newError)("Please pass PublishConfiguration object", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
    const n = s.provider;
    switch (n) {
      case "github": {
        const h = s, g = (h.private ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : null) || h.token;
        return g == null ? new c.GitHubProvider(h, i, r) : new a.PrivateGitHubProvider(h, i, g, r);
      }
      case "bitbucket":
        return new d.BitbucketProvider(s, i, r);
      case "gitlab":
        return new f.GitLabProvider(s, i, r);
      case "keygen":
        return new u.KeygenProvider(s, i, r);
      case "s3":
      case "spaces":
        return new p.GenericProvider({
          provider: "generic",
          url: (0, t.getS3LikeProviderBaseUrl)(s),
          channel: s.channel || null
        }, i, {
          ...r,
          // https://github.com/minio/minio/issues/5285#issuecomment-350428955
          isUseMultipleRangeRequest: !1
        });
      case "generic": {
        const h = s;
        return new p.GenericProvider(h, i, {
          ...r,
          isUseMultipleRangeRequest: h.useMultipleRangeRequest !== !1 && l(h.url)
        });
      }
      case "custom": {
        const h = s, g = h.updateProvider;
        if (!g)
          throw (0, t.newError)("Custom provider not specified", "ERR_UPDATER_INVALID_PROVIDER_CONFIGURATION");
        return new g(h, i, r);
      }
      default:
        throw (0, t.newError)(`Unsupported provider: ${n}`, "ERR_UPDATER_UNSUPPORTED_PROVIDER");
    }
  }
  return Qt;
}
var nr = {}, ir = {}, qt = {}, $t = {}, fl;
function va() {
  if (fl) return $t;
  fl = 1, Object.defineProperty($t, "__esModule", { value: !0 }), $t.OperationKind = void 0, $t.computeOperations = d;
  var t;
  (function(a) {
    a[a.COPY = 0] = "COPY", a[a.DOWNLOAD = 1] = "DOWNLOAD";
  })(t || ($t.OperationKind = t = {}));
  function d(a, l, o) {
    const s = u(a.files), i = u(l.files);
    let r = null;
    const n = l.files[0], h = [], g = n.name, y = s.get(g);
    if (y == null)
      throw new Error(`no file ${g} in old blockmap`);
    const m = i.get(g);
    let _ = 0;
    const { checksumToOffset: T, checksumToOldSize: P } = f(s.get(g), y.offset, o);
    let O = n.offset;
    for (let b = 0; b < m.checksums.length; O += m.sizes[b], b++) {
      const I = m.sizes[b], S = m.checksums[b];
      let A = T.get(S);
      A != null && P.get(S) !== I && (o.warn(`Checksum ("${S}") matches, but size differs (old: ${P.get(S)}, new: ${I})`), A = void 0), A === void 0 ? (_++, r != null && r.kind === t.DOWNLOAD && r.end === O ? r.end += I : (r = {
        kind: t.DOWNLOAD,
        start: O,
        end: O + I
        // oldBlocks: null,
      }, c(r, h, S, b))) : r != null && r.kind === t.COPY && r.end === A ? r.end += I : (r = {
        kind: t.COPY,
        start: A,
        end: A + I
        // oldBlocks: [checksum]
      }, c(r, h, S, b));
    }
    return _ > 0 && o.info(`File${n.name === "file" ? "" : " " + n.name} has ${_} changed blocks`), h;
  }
  const p = process.env.DIFFERENTIAL_DOWNLOAD_PLAN_BUILDER_VALIDATE_RANGES === "true";
  function c(a, l, o, s) {
    if (p && l.length !== 0) {
      const i = l[l.length - 1];
      if (i.kind === a.kind && a.start < i.end && a.start > i.start) {
        const r = [i.start, i.end, a.start, a.end].reduce((n, h) => n < h ? n : h);
        throw new Error(`operation (block index: ${s}, checksum: ${o}, kind: ${t[a.kind]}) overlaps previous operation (checksum: ${o}):
abs: ${i.start} until ${i.end} and ${a.start} until ${a.end}
rel: ${i.start - r} until ${i.end - r} and ${a.start - r} until ${a.end - r}`);
      }
    }
    l.push(a);
  }
  function f(a, l, o) {
    const s = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map();
    let r = l;
    for (let n = 0; n < a.checksums.length; n++) {
      const h = a.checksums[n], g = a.sizes[n], y = i.get(h);
      if (y === void 0)
        s.set(h, r), i.set(h, g);
      else if (o.debug != null) {
        const m = y === g ? "(same size)" : `(size: ${y}, this size: ${g})`;
        o.debug(`${h} duplicated in blockmap ${m}, it doesn't lead to broken differential downloader, just corresponding block will be skipped)`);
      }
      r += g;
    }
    return { checksumToOffset: s, checksumToOldSize: i };
  }
  function u(a) {
    const l = /* @__PURE__ */ new Map();
    for (const o of a)
      l.set(o.name, o);
    return l;
  }
  return $t;
}
var dl;
function mu() {
  if (dl) return qt;
  dl = 1, Object.defineProperty(qt, "__esModule", { value: !0 }), qt.DataSplitter = void 0, qt.copyData = a;
  const t = Le(), d = mt, p = vr, c = va(), f = Buffer.from(`\r
\r
`);
  var u;
  (function(o) {
    o[o.INIT = 0] = "INIT", o[o.HEADER = 1] = "HEADER", o[o.BODY = 2] = "BODY";
  })(u || (u = {}));
  function a(o, s, i, r, n) {
    const h = (0, d.createReadStream)("", {
      fd: i,
      autoClose: !1,
      start: o.start,
      // end is inclusive
      end: o.end - 1
    });
    h.on("error", r), h.once("end", n), h.pipe(s, {
      end: !1
    });
  }
  let l = class extends p.Writable {
    constructor(s, i, r, n, h, g, y, m) {
      super(), this.out = s, this.options = i, this.partIndexToTaskIndex = r, this.partIndexToLength = h, this.finishHandler = g, this.grandTotalBytes = y, this.onProgress = m, this.start = Date.now(), this.nextUpdate = this.start + 1e3, this.transferred = 0, this.delta = 0, this.partIndex = -1, this.headerListBuffer = null, this.readState = u.INIT, this.ignoreByteCount = 0, this.remainingPartDataCount = 0, this.actualPartLength = 0, this.boundaryLength = n.length + 4, this.ignoreByteCount = this.boundaryLength - 2;
    }
    get isFinished() {
      return this.partIndex === this.partIndexToLength.length;
    }
    // noinspection JSUnusedGlobalSymbols
    _write(s, i, r) {
      if (this.isFinished) {
        console.error(`Trailing ignored data: ${s.length} bytes`);
        return;
      }
      this.handleData(s).then(() => {
        if (this.onProgress) {
          const n = Date.now();
          (n >= this.nextUpdate || this.transferred === this.grandTotalBytes) && this.grandTotalBytes && (n - this.start) / 1e3 && (this.nextUpdate = n + 1e3, this.onProgress({
            total: this.grandTotalBytes,
            delta: this.delta,
            transferred: this.transferred,
            percent: this.transferred / this.grandTotalBytes * 100,
            bytesPerSecond: Math.round(this.transferred / ((n - this.start) / 1e3))
          }), this.delta = 0);
        }
        r();
      }).catch(r);
    }
    async handleData(s) {
      let i = 0;
      if (this.ignoreByteCount !== 0 && this.remainingPartDataCount !== 0)
        throw (0, t.newError)("Internal error", "ERR_DATA_SPLITTER_BYTE_COUNT_MISMATCH");
      if (this.ignoreByteCount > 0) {
        const r = Math.min(this.ignoreByteCount, s.length);
        this.ignoreByteCount -= r, i = r;
      } else if (this.remainingPartDataCount > 0) {
        const r = Math.min(this.remainingPartDataCount, s.length);
        this.remainingPartDataCount -= r, await this.processPartData(s, 0, r), i = r;
      }
      if (i !== s.length) {
        if (this.readState === u.HEADER) {
          const r = this.searchHeaderListEnd(s, i);
          if (r === -1)
            return;
          i = r, this.readState = u.BODY, this.headerListBuffer = null;
        }
        for (; ; ) {
          if (this.readState === u.BODY)
            this.readState = u.INIT;
          else {
            this.partIndex++;
            let g = this.partIndexToTaskIndex.get(this.partIndex);
            if (g == null)
              if (this.isFinished)
                g = this.options.end;
              else
                throw (0, t.newError)("taskIndex is null", "ERR_DATA_SPLITTER_TASK_INDEX_IS_NULL");
            const y = this.partIndex === 0 ? this.options.start : this.partIndexToTaskIndex.get(this.partIndex - 1) + 1;
            if (y < g)
              await this.copyExistingData(y, g);
            else if (y > g)
              throw (0, t.newError)("prevTaskIndex must be < taskIndex", "ERR_DATA_SPLITTER_TASK_INDEX_ASSERT_FAILED");
            if (this.isFinished) {
              this.onPartEnd(), this.finishHandler();
              return;
            }
            if (i = this.searchHeaderListEnd(s, i), i === -1) {
              this.readState = u.HEADER;
              return;
            }
          }
          const r = this.partIndexToLength[this.partIndex], n = i + r, h = Math.min(n, s.length);
          if (await this.processPartStarted(s, i, h), this.remainingPartDataCount = r - (h - i), this.remainingPartDataCount > 0)
            return;
          if (i = n + this.boundaryLength, i >= s.length) {
            this.ignoreByteCount = this.boundaryLength - (s.length - n);
            return;
          }
        }
      }
    }
    copyExistingData(s, i) {
      return new Promise((r, n) => {
        const h = () => {
          if (s === i) {
            r();
            return;
          }
          const g = this.options.tasks[s];
          if (g.kind !== c.OperationKind.COPY) {
            n(new Error("Task kind must be COPY"));
            return;
          }
          a(g, this.out, this.options.oldFileFd, n, () => {
            s++, h();
          });
        };
        h();
      });
    }
    searchHeaderListEnd(s, i) {
      const r = s.indexOf(f, i);
      if (r !== -1)
        return r + f.length;
      const n = i === 0 ? s : s.slice(i);
      return this.headerListBuffer == null ? this.headerListBuffer = n : this.headerListBuffer = Buffer.concat([this.headerListBuffer, n]), -1;
    }
    onPartEnd() {
      const s = this.partIndexToLength[this.partIndex - 1];
      if (this.actualPartLength !== s)
        throw (0, t.newError)(`Expected length: ${s} differs from actual: ${this.actualPartLength}`, "ERR_DATA_SPLITTER_LENGTH_MISMATCH");
      this.actualPartLength = 0;
    }
    processPartStarted(s, i, r) {
      return this.partIndex !== 0 && this.onPartEnd(), this.processPartData(s, i, r);
    }
    processPartData(s, i, r) {
      this.actualPartLength += r - i, this.transferred += r - i, this.delta += r - i;
      const n = this.out;
      return n.write(i === 0 && s.length === r ? s : s.slice(i, r)) ? Promise.resolve() : new Promise((h, g) => {
        n.on("error", g), n.once("drain", () => {
          n.removeListener("error", g), h();
        });
      });
    }
  };
  return qt.DataSplitter = l, qt;
}
var ar = {}, hl;
function Jf() {
  if (hl) return ar;
  hl = 1, Object.defineProperty(ar, "__esModule", { value: !0 }), ar.executeTasksUsingMultipleRangeRequests = c, ar.checkIsRangesSupported = u;
  const t = Le(), d = mu(), p = va();
  function c(a, l, o, s, i) {
    const r = (n) => {
      if (n >= l.length) {
        a.fileMetadataBuffer != null && o.write(a.fileMetadataBuffer), o.end();
        return;
      }
      const h = n + 1e3;
      f(a, {
        tasks: l,
        start: n,
        end: Math.min(l.length, h),
        oldFileFd: s
      }, o, () => r(h), i);
    };
    return r;
  }
  function f(a, l, o, s, i) {
    let r = "bytes=", n = 0, h = 0;
    const g = /* @__PURE__ */ new Map(), y = [];
    for (let T = l.start; T < l.end; T++) {
      const P = l.tasks[T];
      P.kind === p.OperationKind.DOWNLOAD && (r += `${P.start}-${P.end - 1}, `, g.set(n, T), n++, y.push(P.end - P.start), h += P.end - P.start);
    }
    if (n <= 1) {
      const T = (P) => {
        if (P >= l.end) {
          s();
          return;
        }
        const O = l.tasks[P++];
        if (O.kind === p.OperationKind.COPY)
          (0, d.copyData)(O, o, l.oldFileFd, i, () => T(P));
        else {
          const b = a.createRequestOptions();
          b.headers.Range = `bytes=${O.start}-${O.end - 1}`;
          const I = a.httpExecutor.createRequest(b, (S) => {
            S.on("error", i), u(S, i) && (S.pipe(o, {
              end: !1
            }), S.once("end", () => T(P)));
          });
          a.httpExecutor.addErrorAndTimeoutHandlers(I, i), I.end();
        }
      };
      T(l.start);
      return;
    }
    const m = a.createRequestOptions();
    m.headers.Range = r.substring(0, r.length - 2);
    const _ = a.httpExecutor.createRequest(m, (T) => {
      if (!u(T, i))
        return;
      const P = (0, t.safeGetHeader)(T, "content-type"), O = /^multipart\/.+?\s*;\s*boundary=(?:"([^"]+)"|([^\s";]+))\s*$/i.exec(P);
      if (O == null) {
        i(new Error(`Content-Type "multipart/byteranges" is expected, but got "${P}"`));
        return;
      }
      const b = new d.DataSplitter(o, l, g, O[1] || O[2], y, s, h, a.options.onProgress);
      b.on("error", i), T.pipe(b), T.on("end", () => {
        setTimeout(() => {
          _.abort(), i(new Error("Response ends without calling any handlers"));
        }, 1e4);
      });
    });
    a.httpExecutor.addErrorAndTimeoutHandlers(_, i), _.end();
  }
  function u(a, l) {
    if (a.statusCode >= 400)
      return l((0, t.createHttpError)(a)), !1;
    if (a.statusCode !== 206) {
      const o = (0, t.safeGetHeader)(a, "accept-ranges");
      if (o == null || o === "none")
        return l(new Error(`Server doesn't support Accept-Ranges (response code ${a.statusCode})`)), !1;
    }
    return !0;
  }
  return ar;
}
var or = {}, pl;
function Qf() {
  if (pl) return or;
  pl = 1, Object.defineProperty(or, "__esModule", { value: !0 }), or.ProgressDifferentialDownloadCallbackTransform = void 0;
  const t = vr;
  var d;
  (function(c) {
    c[c.COPY = 0] = "COPY", c[c.DOWNLOAD = 1] = "DOWNLOAD";
  })(d || (d = {}));
  let p = class extends t.Transform {
    constructor(f, u, a) {
      super(), this.progressDifferentialDownloadInfo = f, this.cancellationToken = u, this.onProgress = a, this.start = Date.now(), this.transferred = 0, this.delta = 0, this.expectedBytes = 0, this.index = 0, this.operationType = d.COPY, this.nextUpdate = this.start + 1e3;
    }
    _transform(f, u, a) {
      if (this.cancellationToken.cancelled) {
        a(new Error("cancelled"), null);
        return;
      }
      if (this.operationType == d.COPY) {
        a(null, f);
        return;
      }
      this.transferred += f.length, this.delta += f.length;
      const l = Date.now();
      l >= this.nextUpdate && this.transferred !== this.expectedBytes && this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && (this.nextUpdate = l + 1e3, this.onProgress({
        total: this.progressDifferentialDownloadInfo.grandTotal,
        delta: this.delta,
        transferred: this.transferred,
        percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
        bytesPerSecond: Math.round(this.transferred / ((l - this.start) / 1e3))
      }), this.delta = 0), a(null, f);
    }
    beginFileCopy() {
      this.operationType = d.COPY;
    }
    beginRangeDownload() {
      this.operationType = d.DOWNLOAD, this.expectedBytes += this.progressDifferentialDownloadInfo.expectedByteCounts[this.index++];
    }
    endRangeDownload() {
      this.transferred !== this.progressDifferentialDownloadInfo.grandTotal && this.onProgress({
        total: this.progressDifferentialDownloadInfo.grandTotal,
        delta: this.delta,
        transferred: this.transferred,
        percent: this.transferred / this.progressDifferentialDownloadInfo.grandTotal * 100,
        bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
      });
    }
    // Called when we are 100% done with the connection/download
    _flush(f) {
      if (this.cancellationToken.cancelled) {
        f(new Error("cancelled"));
        return;
      }
      this.onProgress({
        total: this.progressDifferentialDownloadInfo.grandTotal,
        delta: this.delta,
        transferred: this.transferred,
        percent: 100,
        bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1e3))
      }), this.delta = 0, this.transferred = 0, f(null);
    }
  };
  return or.ProgressDifferentialDownloadCallbackTransform = p, or;
}
var ml;
function gu() {
  if (ml) return ir;
  ml = 1, Object.defineProperty(ir, "__esModule", { value: !0 }), ir.DifferentialDownloader = void 0;
  const t = Le(), d = /* @__PURE__ */ vt(), p = mt, c = mu(), f = gt, u = va(), a = Jf(), l = Qf();
  let o = class {
    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    constructor(n, h, g) {
      this.blockAwareFileInfo = n, this.httpExecutor = h, this.options = g, this.fileMetadataBuffer = null, this.logger = g.logger;
    }
    createRequestOptions() {
      const n = {
        headers: {
          ...this.options.requestHeaders,
          accept: "*/*"
        }
      };
      return (0, t.configureRequestUrl)(this.options.newUrl, n), (0, t.configureRequestOptions)(n), n;
    }
    doDownload(n, h) {
      if (n.version !== h.version)
        throw new Error(`version is different (${n.version} - ${h.version}), full download is required`);
      const g = this.logger, y = (0, u.computeOperations)(n, h, g);
      g.debug != null && g.debug(JSON.stringify(y, null, 2));
      let m = 0, _ = 0;
      for (const P of y) {
        const O = P.end - P.start;
        P.kind === u.OperationKind.DOWNLOAD ? m += O : _ += O;
      }
      const T = this.blockAwareFileInfo.size;
      if (m + _ + (this.fileMetadataBuffer == null ? 0 : this.fileMetadataBuffer.length) !== T)
        throw new Error(`Internal error, size mismatch: downloadSize: ${m}, copySize: ${_}, newSize: ${T}`);
      return g.info(`Full: ${s(T)}, To download: ${s(m)} (${Math.round(m / (T / 100))}%)`), this.downloadFile(y);
    }
    downloadFile(n) {
      const h = [], g = () => Promise.all(h.map((y) => (0, d.close)(y.descriptor).catch((m) => {
        this.logger.error(`cannot close file "${y.path}": ${m}`);
      })));
      return this.doDownloadFile(n, h).then(g).catch((y) => g().catch((m) => {
        try {
          this.logger.error(`cannot close files: ${m}`);
        } catch (_) {
          try {
            console.error(_);
          } catch {
          }
        }
        throw y;
      }).then(() => {
        throw y;
      }));
    }
    async doDownloadFile(n, h) {
      const g = await (0, d.open)(this.options.oldFile, "r");
      h.push({ descriptor: g, path: this.options.oldFile });
      const y = await (0, d.open)(this.options.newFile, "w");
      h.push({ descriptor: y, path: this.options.newFile });
      const m = (0, p.createWriteStream)(this.options.newFile, { fd: y });
      await new Promise((_, T) => {
        const P = [];
        let O;
        if (!this.options.isUseMultipleRangeRequest && this.options.onProgress) {
          const x = [];
          let $ = 0;
          for (const N of n)
            N.kind === u.OperationKind.DOWNLOAD && (x.push(N.end - N.start), $ += N.end - N.start);
          const L = {
            expectedByteCounts: x,
            grandTotal: $
          };
          O = new l.ProgressDifferentialDownloadCallbackTransform(L, this.options.cancellationToken, this.options.onProgress), P.push(O);
        }
        const b = new t.DigestTransform(this.blockAwareFileInfo.sha512);
        b.isValidateOnEnd = !1, P.push(b), m.on("finish", () => {
          m.close(() => {
            h.splice(1, 1);
            try {
              b.validate();
            } catch (x) {
              T(x);
              return;
            }
            _(void 0);
          });
        }), P.push(m);
        let I = null;
        for (const x of P)
          x.on("error", T), I == null ? I = x : I = I.pipe(x);
        const S = P[0];
        let A;
        if (this.options.isUseMultipleRangeRequest) {
          A = (0, a.executeTasksUsingMultipleRangeRequests)(this, n, S, g, T), A(0);
          return;
        }
        let v = 0, k = null;
        this.logger.info(`Differential download: ${this.options.newUrl}`);
        const q = this.createRequestOptions();
        q.redirect = "manual", A = (x) => {
          var $, L;
          if (x >= n.length) {
            this.fileMetadataBuffer != null && S.write(this.fileMetadataBuffer), S.end();
            return;
          }
          const N = n[x++];
          if (N.kind === u.OperationKind.COPY) {
            O && O.beginFileCopy(), (0, c.copyData)(N, S, g, T, () => A(x));
            return;
          }
          const j = `bytes=${N.start}-${N.end - 1}`;
          q.headers.range = j, (L = ($ = this.logger) === null || $ === void 0 ? void 0 : $.debug) === null || L === void 0 || L.call($, `download range: ${j}`), O && O.beginRangeDownload();
          const D = this.httpExecutor.createRequest(q, (G) => {
            G.on("error", T), G.on("aborted", () => {
              T(new Error("response has been aborted by the server"));
            }), G.statusCode >= 400 && T((0, t.createHttpError)(G)), G.pipe(S, {
              end: !1
            }), G.once("end", () => {
              O && O.endRangeDownload(), ++v === 100 ? (v = 0, setTimeout(() => A(x), 1e3)) : A(x);
            });
          });
          D.on("redirect", (G, V, te) => {
            this.logger.info(`Redirect to ${i(te)}`), k = te, (0, t.configureRequestUrl)(new f.URL(k), q), D.followRedirect();
          }), this.httpExecutor.addErrorAndTimeoutHandlers(D, T), D.end();
        }, A(0);
      });
    }
    async readRemoteBytes(n, h) {
      const g = Buffer.allocUnsafe(h + 1 - n), y = this.createRequestOptions();
      y.headers.range = `bytes=${n}-${h}`;
      let m = 0;
      if (await this.request(y, (_) => {
        _.copy(g, m), m += _.length;
      }), m !== g.length)
        throw new Error(`Received data length ${m} is not equal to expected ${g.length}`);
      return g;
    }
    request(n, h) {
      return new Promise((g, y) => {
        const m = this.httpExecutor.createRequest(n, (_) => {
          (0, a.checkIsRangesSupported)(_, y) && (_.on("error", y), _.on("aborted", () => {
            y(new Error("response has been aborted by the server"));
          }), _.on("data", h), _.on("end", () => g()));
        });
        this.httpExecutor.addErrorAndTimeoutHandlers(m, y), m.end();
      });
    }
  };
  ir.DifferentialDownloader = o;
  function s(r, n = " KB") {
    return new Intl.NumberFormat("en").format((r / 1024).toFixed(2)) + n;
  }
  function i(r) {
    const n = r.indexOf("?");
    return n < 0 ? r : r.substring(0, n);
  }
  return ir;
}
var gl;
function Zf() {
  if (gl) return nr;
  gl = 1, Object.defineProperty(nr, "__esModule", { value: !0 }), nr.GenericDifferentialDownloader = void 0;
  const t = gu();
  let d = class extends t.DifferentialDownloader {
    download(c, f) {
      return this.doDownload(c, f);
    }
  };
  return nr.GenericDifferentialDownloader = d, nr;
}
var ra = {}, vl;
function It() {
  return vl || (vl = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.UpdaterSignal = t.UPDATE_DOWNLOADED = t.DOWNLOAD_PROGRESS = t.CancellationToken = void 0, t.addHandler = c;
    const d = Le();
    Object.defineProperty(t, "CancellationToken", { enumerable: !0, get: function() {
      return d.CancellationToken;
    } }), t.DOWNLOAD_PROGRESS = "download-progress", t.UPDATE_DOWNLOADED = "update-downloaded";
    class p {
      constructor(u) {
        this.emitter = u;
      }
      /**
       * Emitted when an authenticating proxy is [asking for user credentials](https://github.com/electron/electron/blob/master/docs/api/client-request.md#event-login).
       */
      login(u) {
        c(this.emitter, "login", u);
      }
      progress(u) {
        c(this.emitter, t.DOWNLOAD_PROGRESS, u);
      }
      updateDownloaded(u) {
        c(this.emitter, t.UPDATE_DOWNLOADED, u);
      }
      updateCancelled(u) {
        c(this.emitter, "update-cancelled", u);
      }
    }
    t.UpdaterSignal = p;
    function c(f, u, a) {
      f.on(u, a);
    }
  })(ra)), ra;
}
var El;
function Ea() {
  if (El) return Tt;
  El = 1, Object.defineProperty(Tt, "__esModule", { value: !0 }), Tt.NoOpLogger = Tt.AppUpdater = void 0;
  const t = Le(), d = Er, p = Gr, c = kl, f = /* @__PURE__ */ vt(), u = ca(), a = gf(), l = Ie, o = fu(), s = Hf(), i = Gf(), r = Wf(), n = hu(), h = Kf(), g = $l, y = Zf(), m = It();
  let _ = class vu extends c.EventEmitter {
    /**
     * Get the update channel. Doesn't return `channel` from the update configuration, only if was previously set.
     */
    get channel() {
      return this._channel;
    }
    /**
     * Set the update channel. Overrides `channel` in the update configuration.
     *
     * `allowDowngrade` will be automatically set to `true`. If this behavior is not suitable for you, simple set `allowDowngrade` explicitly after.
     */
    set channel(b) {
      if (this._channel != null) {
        if (typeof b != "string")
          throw (0, t.newError)(`Channel must be a string, but got: ${b}`, "ERR_UPDATER_INVALID_CHANNEL");
        if (b.length === 0)
          throw (0, t.newError)("Channel must be not an empty string", "ERR_UPDATER_INVALID_CHANNEL");
      }
      this._channel = b, this.allowDowngrade = !0;
    }
    /**
     *  Shortcut for explicitly adding auth tokens to request headers
     */
    addAuthHeader(b) {
      this.requestHeaders = Object.assign({}, this.requestHeaders, {
        authorization: b
      });
    }
    // noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
    get netSession() {
      return (0, r.getNetSession)();
    }
    /**
     * The logger. You can pass [electron-log](https://github.com/megahertz/electron-log), [winston](https://github.com/winstonjs/winston) or another logger with the following interface: `{ info(), warn(), error() }`.
     * Set it to `null` if you would like to disable a logging feature.
     */
    get logger() {
      return this._logger;
    }
    set logger(b) {
      this._logger = b ?? new P();
    }
    // noinspection JSUnusedGlobalSymbols
    /**
     * test only
     * @private
     */
    set updateConfigPath(b) {
      this.clientPromise = null, this._appUpdateConfigPath = b, this.configOnDisk = new a.Lazy(() => this.loadUpdateConfig());
    }
    /**
     * Allows developer to override default logic for determining if an update is supported.
     * The default logic compares the `UpdateInfo` minimum system version against the `os.release()` with `semver` package
     */
    get isUpdateSupported() {
      return this._isUpdateSupported;
    }
    set isUpdateSupported(b) {
      b && (this._isUpdateSupported = b);
    }
    /**
     * Allows developer to override default logic for determining if the user is below the rollout threshold.
     * The default logic compares the staging percentage with numerical representation of user ID.
     * An override can define custom logic, or bypass it if needed.
     */
    get isUserWithinRollout() {
      return this._isUserWithinRollout;
    }
    set isUserWithinRollout(b) {
      b && (this._isUserWithinRollout = b);
    }
    constructor(b, I) {
      super(), this.autoDownload = !0, this.autoInstallOnAppQuit = !0, this.autoRunAppAfterInstall = !0, this.allowPrerelease = !1, this.fullChangelog = !1, this.allowDowngrade = !1, this.disableWebInstaller = !1, this.disableDifferentialDownload = !1, this.forceDevUpdateConfig = !1, this.previousBlockmapBaseUrlOverride = null, this._channel = null, this.downloadedUpdateHelper = null, this.requestHeaders = null, this._logger = console, this.signals = new m.UpdaterSignal(this), this._appUpdateConfigPath = null, this._isUpdateSupported = (v) => this.checkIfUpdateSupported(v), this._isUserWithinRollout = (v) => this.isStagingMatch(v), this.clientPromise = null, this.stagingUserIdPromise = new a.Lazy(() => this.getOrCreateStagingUserId()), this.configOnDisk = new a.Lazy(() => this.loadUpdateConfig()), this.checkForUpdatesPromise = null, this.downloadPromise = null, this.updateInfoAndProvider = null, this._testOnlyOptions = null, this.on("error", (v) => {
        this._logger.error(`Error: ${v.stack || v.message}`);
      }), I == null ? (this.app = new i.ElectronAppAdapter(), this.httpExecutor = new r.ElectronHttpExecutor((v, k) => this.emit("login", v, k))) : (this.app = I, this.httpExecutor = null);
      const S = this.app.version, A = (0, o.parse)(S);
      if (A == null)
        throw (0, t.newError)(`App version is not a valid semver version: "${S}"`, "ERR_UPDATER_INVALID_VERSION");
      this.currentVersion = A, this.allowPrerelease = T(A), b != null && (this.setFeedURL(b), typeof b != "string" && b.requestHeaders && (this.requestHeaders = b.requestHeaders));
    }
    //noinspection JSMethodCanBeStatic,JSUnusedGlobalSymbols
    getFeedURL() {
      return "Deprecated. Do not use it.";
    }
    /**
     * Configure update provider. If value is `string`, [GenericServerOptions](./publish.md#genericserveroptions) will be set with value as `url`.
     * @param options If you want to override configuration in the `app-update.yml`.
     */
    setFeedURL(b) {
      const I = this.createProviderRuntimeOptions();
      let S;
      typeof b == "string" ? S = new n.GenericProvider({ provider: "generic", url: b }, this, {
        ...I,
        isUseMultipleRangeRequest: (0, h.isUrlProbablySupportMultiRangeRequests)(b)
      }) : S = (0, h.createClient)(b, this, I), this.clientPromise = Promise.resolve(S);
    }
    /**
     * Asks the server whether there is an update.
     * @returns null if the updater is disabled, otherwise info about the latest version
     */
    checkForUpdates() {
      if (!this.isUpdaterActive())
        return Promise.resolve(null);
      let b = this.checkForUpdatesPromise;
      if (b != null)
        return this._logger.info("Checking for update (already in progress)"), b;
      const I = () => this.checkForUpdatesPromise = null;
      return this._logger.info("Checking for update"), b = this.doCheckForUpdates().then((S) => (I(), S)).catch((S) => {
        throw I(), this.emit("error", S, `Cannot check for updates: ${(S.stack || S).toString()}`), S;
      }), this.checkForUpdatesPromise = b, b;
    }
    isUpdaterActive() {
      return this.app.isPackaged || this.forceDevUpdateConfig ? !0 : (this._logger.info("Skip checkForUpdates because application is not packed and dev update config is not forced"), !1);
    }
    // noinspection JSUnusedGlobalSymbols
    checkForUpdatesAndNotify(b) {
      return this.checkForUpdates().then((I) => I?.downloadPromise ? (I.downloadPromise.then(() => {
        const S = vu.formatDownloadNotification(I.updateInfo.version, this.app.name, b);
        new bt.Notification(S).show();
      }), I) : (this._logger.debug != null && this._logger.debug("checkForUpdatesAndNotify called, downloadPromise is null"), I));
    }
    static formatDownloadNotification(b, I, S) {
      return S == null && (S = {
        title: "A new update is ready to install",
        body: "{appName} version {version} has been downloaded and will be automatically installed on exit"
      }), S = {
        title: S.title.replace("{appName}", I).replace("{version}", b),
        body: S.body.replace("{appName}", I).replace("{version}", b)
      }, S;
    }
    async isStagingMatch(b) {
      const I = b.stagingPercentage;
      let S = I;
      if (S == null)
        return !0;
      if (S = parseInt(S, 10), isNaN(S))
        return this._logger.warn(`Staging percentage is NaN: ${I}`), !0;
      S = S / 100;
      const A = await this.stagingUserIdPromise.value, k = t.UUID.parse(A).readUInt32BE(12) / 4294967295;
      return this._logger.info(`Staging percentage: ${S}, percentage: ${k}, user id: ${A}`), k < S;
    }
    computeFinalHeaders(b) {
      return this.requestHeaders != null && Object.assign(b, this.requestHeaders), b;
    }
    async isUpdateAvailable(b) {
      const I = (0, o.parse)(b.version);
      if (I == null)
        throw (0, t.newError)(`This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "${b.version}"`, "ERR_UPDATER_INVALID_VERSION");
      const S = this.currentVersion;
      if ((0, o.eq)(I, S) || !await Promise.resolve(this.isUpdateSupported(b)) || !await Promise.resolve(this.isUserWithinRollout(b)))
        return !1;
      const v = (0, o.gt)(I, S), k = (0, o.lt)(I, S);
      return v ? !0 : this.allowDowngrade && k;
    }
    checkIfUpdateSupported(b) {
      const I = b?.minimumSystemVersion, S = (0, p.release)();
      if (I)
        try {
          if ((0, o.lt)(S, I))
            return this._logger.info(`Current OS version ${S} is less than the minimum OS version required ${I} for version ${S}`), !1;
        } catch (A) {
          this._logger.warn(`Failed to compare current OS version(${S}) with minimum OS version(${I}): ${(A.message || A).toString()}`);
        }
      return !0;
    }
    async getUpdateInfoAndProvider() {
      await this.app.whenReady(), this.clientPromise == null && (this.clientPromise = this.configOnDisk.value.then((S) => (0, h.createClient)(S, this, this.createProviderRuntimeOptions())));
      const b = await this.clientPromise, I = await this.stagingUserIdPromise.value;
      return b.setRequestHeaders(this.computeFinalHeaders({ "x-user-staging-id": I })), {
        info: await b.getLatestVersion(),
        provider: b
      };
    }
    createProviderRuntimeOptions() {
      return {
        isUseMultipleRangeRequest: !0,
        platform: this._testOnlyOptions == null ? process.platform : this._testOnlyOptions.platform,
        executor: this.httpExecutor
      };
    }
    async doCheckForUpdates() {
      this.emit("checking-for-update");
      const b = await this.getUpdateInfoAndProvider(), I = b.info;
      if (!await this.isUpdateAvailable(I))
        return this._logger.info(`Update for version ${this.currentVersion.format()} is not available (latest version: ${I.version}, downgrade is ${this.allowDowngrade ? "allowed" : "disallowed"}).`), this.emit("update-not-available", I), {
          isUpdateAvailable: !1,
          versionInfo: I,
          updateInfo: I
        };
      this.updateInfoAndProvider = b, this.onUpdateAvailable(I);
      const S = new t.CancellationToken();
      return {
        isUpdateAvailable: !0,
        versionInfo: I,
        updateInfo: I,
        cancellationToken: S,
        downloadPromise: this.autoDownload ? this.downloadUpdate(S) : null
      };
    }
    onUpdateAvailable(b) {
      this._logger.info(`Found version ${b.version} (url: ${(0, t.asArray)(b.files).map((I) => I.url).join(", ")})`), this.emit("update-available", b);
    }
    /**
     * Start downloading update manually. You can use this method if `autoDownload` option is set to `false`.
     * @returns {Promise<Array<string>>} Paths to downloaded files.
     */
    downloadUpdate(b = new t.CancellationToken()) {
      const I = this.updateInfoAndProvider;
      if (I == null) {
        const A = new Error("Please check update first");
        return this.dispatchError(A), Promise.reject(A);
      }
      if (this.downloadPromise != null)
        return this._logger.info("Downloading update (already in progress)"), this.downloadPromise;
      this._logger.info(`Downloading update from ${(0, t.asArray)(I.info.files).map((A) => A.url).join(", ")}`);
      const S = (A) => {
        if (!(A instanceof t.CancellationError))
          try {
            this.dispatchError(A);
          } catch (v) {
            this._logger.warn(`Cannot dispatch error event: ${v.stack || v}`);
          }
        return A;
      };
      return this.downloadPromise = this.doDownloadUpdate({
        updateInfoAndProvider: I,
        requestHeaders: this.computeRequestHeaders(I.provider),
        cancellationToken: b,
        disableWebInstaller: this.disableWebInstaller,
        disableDifferentialDownload: this.disableDifferentialDownload
      }).catch((A) => {
        throw S(A);
      }).finally(() => {
        this.downloadPromise = null;
      }), this.downloadPromise;
    }
    dispatchError(b) {
      this.emit("error", b, (b.stack || b).toString());
    }
    dispatchUpdateDownloaded(b) {
      this.emit(m.UPDATE_DOWNLOADED, b);
    }
    async loadUpdateConfig() {
      return this._appUpdateConfigPath == null && (this._appUpdateConfigPath = this.app.appUpdateConfigPath), (0, u.load)(await (0, f.readFile)(this._appUpdateConfigPath, "utf-8"));
    }
    computeRequestHeaders(b) {
      const I = b.fileExtraDownloadHeaders;
      if (I != null) {
        const S = this.requestHeaders;
        return S == null ? I : {
          ...I,
          ...S
        };
      }
      return this.computeFinalHeaders({ accept: "*/*" });
    }
    async getOrCreateStagingUserId() {
      const b = l.join(this.app.userDataPath, ".updaterId");
      try {
        const S = await (0, f.readFile)(b, "utf-8");
        if (t.UUID.check(S))
          return S;
        this._logger.warn(`Staging user id file exists, but content was invalid: ${S}`);
      } catch (S) {
        S.code !== "ENOENT" && this._logger.warn(`Couldn't read staging user ID, creating a blank one: ${S}`);
      }
      const I = t.UUID.v5((0, d.randomBytes)(4096), t.UUID.OID);
      this._logger.info(`Generated new staging user ID: ${I}`);
      try {
        await (0, f.outputFile)(b, I);
      } catch (S) {
        this._logger.warn(`Couldn't write out staging user ID: ${S}`);
      }
      return I;
    }
    /** @internal */
    get isAddNoCacheQuery() {
      const b = this.requestHeaders;
      if (b == null)
        return !0;
      for (const I of Object.keys(b)) {
        const S = I.toLowerCase();
        if (S === "authorization" || S === "private-token")
          return !1;
      }
      return !0;
    }
    async getOrCreateDownloadHelper() {
      let b = this.downloadedUpdateHelper;
      if (b == null) {
        const I = (await this.configOnDisk.value).updaterCacheDirName, S = this._logger;
        I == null && S.error("updaterCacheDirName is not specified in app-update.yml Was app build using at least electron-builder 20.34.0?");
        const A = l.join(this.app.baseCachePath, I || this.app.name);
        S.debug != null && S.debug(`updater cache dir: ${A}`), b = new s.DownloadedUpdateHelper(A), this.downloadedUpdateHelper = b;
      }
      return b;
    }
    async executeDownload(b) {
      const I = b.fileInfo, S = {
        headers: b.downloadUpdateOptions.requestHeaders,
        cancellationToken: b.downloadUpdateOptions.cancellationToken,
        sha2: I.info.sha2,
        sha512: I.info.sha512
      };
      this.listenerCount(m.DOWNLOAD_PROGRESS) > 0 && (S.onProgress = (ie) => this.emit(m.DOWNLOAD_PROGRESS, ie));
      const A = b.downloadUpdateOptions.updateInfoAndProvider.info, v = A.version, k = I.packageInfo;
      function q() {
        const ie = decodeURIComponent(b.fileInfo.url.pathname);
        return ie.toLowerCase().endsWith(`.${b.fileExtension.toLowerCase()}`) ? l.basename(ie) : b.fileInfo.info.url;
      }
      const x = await this.getOrCreateDownloadHelper(), $ = x.cacheDirForPendingUpdate;
      await (0, f.mkdir)($, { recursive: !0 });
      const L = q();
      let N = l.join($, L);
      const j = k == null ? null : l.join($, `package-${v}${l.extname(k.path) || ".7z"}`), D = async (ie) => {
        await x.setDownloadedFile(N, j, A, I, L, ie), await b.done({
          ...A,
          downloadedFile: N
        });
        const we = l.join($, "current.blockmap");
        return await (0, f.pathExists)(we) && await (0, f.copyFile)(we, l.join(x.cacheDir, "current.blockmap")), j == null ? [N] : [N, j];
      }, G = this._logger, V = await x.validateDownloadedPath(N, A, I, G);
      if (V != null)
        return N = V, await D(!1);
      const te = async () => (await x.clear().catch(() => {
      }), await (0, f.unlink)(N).catch(() => {
      })), de = await (0, s.createTempUpdateFile)(`temp-${L}`, $, G);
      try {
        await b.task(de, S, j, te), await (0, t.retry)(() => (0, f.rename)(de, N), {
          retries: 60,
          interval: 500,
          shouldRetry: (ie) => ie instanceof Error && /^EBUSY:/.test(ie.message) ? !0 : (G.warn(`Cannot rename temp file to final file: ${ie.message || ie.stack}`), !1)
        });
      } catch (ie) {
        throw await te(), ie instanceof t.CancellationError && (G.info("cancelled"), this.emit("update-cancelled", A)), ie;
      }
      return G.info(`New version ${v} has been downloaded to ${N}`), await D(!0);
    }
    async differentialDownloadInstaller(b, I, S, A, v) {
      try {
        if (this._testOnlyOptions != null && !this._testOnlyOptions.isUseDifferentialDownload)
          return !0;
        const k = I.updateInfoAndProvider.provider, q = await k.getBlockMapFiles(b.url, this.app.version, I.updateInfoAndProvider.info.version, this.previousBlockmapBaseUrlOverride);
        this._logger.info(`Download block maps (old: "${q[0]}", new: ${q[1]})`);
        const x = async (G) => {
          const V = await this.httpExecutor.downloadToBuffer(G, {
            headers: I.requestHeaders,
            cancellationToken: I.cancellationToken
          });
          if (V == null || V.length === 0)
            throw new Error(`Blockmap "${G.href}" is empty`);
          try {
            return JSON.parse((0, g.gunzipSync)(V).toString());
          } catch (te) {
            throw new Error(`Cannot parse blockmap "${G.href}", error: ${te}`);
          }
        }, $ = {
          newUrl: b.url,
          oldFile: l.join(this.downloadedUpdateHelper.cacheDir, v),
          logger: this._logger,
          newFile: S,
          isUseMultipleRangeRequest: k.isUseMultipleRangeRequest,
          requestHeaders: I.requestHeaders,
          cancellationToken: I.cancellationToken
        };
        this.listenerCount(m.DOWNLOAD_PROGRESS) > 0 && ($.onProgress = (G) => this.emit(m.DOWNLOAD_PROGRESS, G));
        const L = async (G, V) => {
          const te = l.join(V, "current.blockmap");
          await (0, f.outputFile)(te, (0, g.gzipSync)(JSON.stringify(G)));
        }, N = async (G) => {
          const V = l.join(G, "current.blockmap");
          try {
            if (await (0, f.pathExists)(V))
              return JSON.parse((0, g.gunzipSync)(await (0, f.readFile)(V)).toString());
          } catch (te) {
            this._logger.warn(`Cannot parse blockmap "${V}", error: ${te}`);
          }
          return null;
        }, j = await x(q[1]);
        await L(j, this.downloadedUpdateHelper.cacheDirForPendingUpdate);
        let D = await N(this.downloadedUpdateHelper.cacheDir);
        return D == null && (D = await x(q[0])), await new y.GenericDifferentialDownloader(b.info, this.httpExecutor, $).download(D, j), !1;
      } catch (k) {
        if (this._logger.error(`Cannot download differentially, fallback to full download: ${k.stack || k}`), this._testOnlyOptions != null)
          throw k;
        return !0;
      }
    }
  };
  Tt.AppUpdater = _;
  function T(O) {
    const b = (0, o.prerelease)(O);
    return b != null && b.length > 0;
  }
  class P {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info(b) {
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    warn(b) {
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error(b) {
    }
  }
  return Tt.NoOpLogger = P, Tt;
}
var yl;
function Zr() {
  if (yl) return Vt;
  yl = 1, Object.defineProperty(Vt, "__esModule", { value: !0 }), Vt.BaseUpdater = void 0;
  const t = jr, d = Ea();
  let p = class extends d.AppUpdater {
    constructor(f, u) {
      super(f, u), this.quitAndInstallCalled = !1, this.quitHandlerAdded = !1;
    }
    quitAndInstall(f = !1, u = !1) {
      this._logger.info("Install on explicit quitAndInstall"), this.install(f, f ? u : this.autoRunAppAfterInstall) ? setImmediate(() => {
        bt.autoUpdater.emit("before-quit-for-update"), this.app.quit();
      }) : this.quitAndInstallCalled = !1;
    }
    executeDownload(f) {
      return super.executeDownload({
        ...f,
        done: (u) => (this.dispatchUpdateDownloaded(u), this.addQuitHandler(), Promise.resolve())
      });
    }
    get installerPath() {
      return this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.file;
    }
    // must be sync (because quit even handler is not async)
    install(f = !1, u = !1) {
      if (this.quitAndInstallCalled)
        return this._logger.warn("install call ignored: quitAndInstallCalled is set to true"), !1;
      const a = this.downloadedUpdateHelper, l = this.installerPath, o = a == null ? null : a.downloadedFileInfo;
      if (l == null || o == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      this.quitAndInstallCalled = !0;
      try {
        return this._logger.info(`Install: isSilent: ${f}, isForceRunAfter: ${u}`), this.doInstall({
          isSilent: f,
          isForceRunAfter: u,
          isAdminRightsRequired: o.isAdminRightsRequired
        });
      } catch (s) {
        return this.dispatchError(s), !1;
      }
    }
    addQuitHandler() {
      this.quitHandlerAdded || !this.autoInstallOnAppQuit || (this.quitHandlerAdded = !0, this.app.onQuit((f) => {
        if (this.quitAndInstallCalled) {
          this._logger.info("Update installer has already been triggered. Quitting application.");
          return;
        }
        if (!this.autoInstallOnAppQuit) {
          this._logger.info("Update will not be installed on quit because autoInstallOnAppQuit is set to false.");
          return;
        }
        if (f !== 0) {
          this._logger.info(`Update will be not installed on quit because application is quitting with exit code ${f}`);
          return;
        }
        this._logger.info("Auto install update on quit"), this.install(!0, !1);
      }));
    }
    spawnSyncLog(f, u = [], a = {}) {
      this._logger.info(`Executing: ${f} with args: ${u}`);
      const l = (0, t.spawnSync)(f, u, {
        env: { ...process.env, ...a },
        encoding: "utf-8",
        shell: !0
      }), { error: o, status: s, stdout: i, stderr: r } = l;
      if (o != null)
        throw this._logger.error(r), o;
      if (s != null && s !== 0)
        throw this._logger.error(r), new Error(`Command ${f} exited with code ${s}`);
      return i.trim();
    }
    /**
     * This handles both node 8 and node 10 way of emitting error when spawning a process
     *   - node 8: Throws the error
     *   - node 10: Emit the error(Need to listen with on)
     */
    // https://github.com/electron-userland/electron-builder/issues/1129
    // Node 8 sends errors: https://nodejs.org/dist/latest-v8.x/docs/api/errors.html#errors_common_system_errors
    async spawnLog(f, u = [], a = void 0, l = "ignore") {
      return this._logger.info(`Executing: ${f} with args: ${u}`), new Promise((o, s) => {
        try {
          const i = { stdio: l, env: a, detached: !0 }, r = (0, t.spawn)(f, u, i);
          r.on("error", (n) => {
            s(n);
          }), r.unref(), r.pid !== void 0 && o(!0);
        } catch (i) {
          s(i);
        }
      });
    }
  };
  return Vt.BaseUpdater = p, Vt;
}
var sr = {}, lr = {}, wl;
function Eu() {
  if (wl) return lr;
  wl = 1, Object.defineProperty(lr, "__esModule", { value: !0 }), lr.FileWithEmbeddedBlockMapDifferentialDownloader = void 0;
  const t = /* @__PURE__ */ vt(), d = gu(), p = $l;
  let c = class extends d.DifferentialDownloader {
    async download() {
      const l = this.blockAwareFileInfo, o = l.size, s = o - (l.blockMapSize + 4);
      this.fileMetadataBuffer = await this.readRemoteBytes(s, o - 1);
      const i = f(this.fileMetadataBuffer.slice(0, this.fileMetadataBuffer.length - 4));
      await this.doDownload(await u(this.options.oldFile), i);
    }
  };
  lr.FileWithEmbeddedBlockMapDifferentialDownloader = c;
  function f(a) {
    return JSON.parse((0, p.inflateRawSync)(a).toString());
  }
  async function u(a) {
    const l = await (0, t.open)(a, "r");
    try {
      const o = (await (0, t.fstat)(l)).size, s = Buffer.allocUnsafe(4);
      await (0, t.read)(l, s, 0, s.length, o - s.length);
      const i = Buffer.allocUnsafe(s.readUInt32BE(0));
      return await (0, t.read)(l, i, 0, i.length, o - s.length - i.length), await (0, t.close)(l), f(i);
    } catch (o) {
      throw await (0, t.close)(l), o;
    }
  }
  return lr;
}
var _l;
function Rl() {
  if (_l) return sr;
  _l = 1, Object.defineProperty(sr, "__esModule", { value: !0 }), sr.AppImageUpdater = void 0;
  const t = Le(), d = jr, p = /* @__PURE__ */ vt(), c = mt, f = Ie, u = Zr(), a = Eu(), l = Ve(), o = It();
  let s = class extends u.BaseUpdater {
    constructor(r, n) {
      super(r, n);
    }
    isUpdaterActive() {
      return process.env.APPIMAGE == null && !this.forceDevUpdateConfig ? (process.env.SNAP == null ? this._logger.warn("APPIMAGE env is not defined, current application is not an AppImage") : this._logger.info("SNAP env is defined, updater is disabled"), !1) : super.isUpdaterActive();
    }
    /*** @private */
    doDownloadUpdate(r) {
      const n = r.updateInfoAndProvider.provider, h = (0, l.findFile)(n.resolveFiles(r.updateInfoAndProvider.info), "AppImage", ["rpm", "deb", "pacman"]);
      return this.executeDownload({
        fileExtension: "AppImage",
        fileInfo: h,
        downloadUpdateOptions: r,
        task: async (g, y) => {
          const m = process.env.APPIMAGE;
          if (m == null)
            throw (0, t.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
          (r.disableDifferentialDownload || await this.downloadDifferential(h, m, g, n, r)) && await this.httpExecutor.download(h.url, g, y), await (0, p.chmod)(g, 493);
        }
      });
    }
    async downloadDifferential(r, n, h, g, y) {
      try {
        const m = {
          newUrl: r.url,
          oldFile: n,
          logger: this._logger,
          newFile: h,
          isUseMultipleRangeRequest: g.isUseMultipleRangeRequest,
          requestHeaders: y.requestHeaders,
          cancellationToken: y.cancellationToken
        };
        return this.listenerCount(o.DOWNLOAD_PROGRESS) > 0 && (m.onProgress = (_) => this.emit(o.DOWNLOAD_PROGRESS, _)), await new a.FileWithEmbeddedBlockMapDifferentialDownloader(r.info, this.httpExecutor, m).download(), !1;
      } catch (m) {
        return this._logger.error(`Cannot download differentially, fallback to full download: ${m.stack || m}`), process.platform === "linux";
      }
    }
    doInstall(r) {
      const n = process.env.APPIMAGE;
      if (n == null)
        throw (0, t.newError)("APPIMAGE env is not defined", "ERR_UPDATER_OLD_FILE_NOT_FOUND");
      (0, c.unlinkSync)(n);
      let h;
      const g = f.basename(n), y = this.installerPath;
      if (y == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      f.basename(y) === g || !/\d+\.\d+\.\d+/.test(g) ? h = n : h = f.join(f.dirname(n), f.basename(y)), (0, d.execFileSync)("mv", ["-f", y, h]), h !== n && this.emit("appimage-filename-updated", h);
      const m = {
        ...process.env,
        APPIMAGE_SILENT_INSTALL: "true"
      };
      return r.isForceRunAfter ? this.spawnLog(h, [], m) : (m.APPIMAGE_EXIT_AFTER_INSTALL = "true", (0, d.execFileSync)(h, [], { env: m })), !0;
    }
  };
  return sr.AppImageUpdater = s, sr;
}
var ur = {}, cr = {}, Al;
function ya() {
  if (Al) return cr;
  Al = 1, Object.defineProperty(cr, "__esModule", { value: !0 }), cr.LinuxUpdater = void 0;
  const t = Zr();
  let d = class extends t.BaseUpdater {
    constructor(c, f) {
      super(c, f);
    }
    /**
     * Returns true if the current process is running as root.
     */
    isRunningAsRoot() {
      var c;
      return ((c = process.getuid) === null || c === void 0 ? void 0 : c.call(process)) === 0;
    }
    /**
     * Sanitizies the installer path for using with command line tools.
     */
    get installerPath() {
      var c, f;
      return (f = (c = super.installerPath) === null || c === void 0 ? void 0 : c.replace(/\\/g, "\\\\").replace(/ /g, "\\ ")) !== null && f !== void 0 ? f : null;
    }
    runCommandWithSudoIfNeeded(c) {
      if (this.isRunningAsRoot())
        return this._logger.info("Running as root, no need to use sudo"), this.spawnSyncLog(c[0], c.slice(1));
      const { name: f } = this.app, u = `"${f} would like to update"`, a = this.sudoWithArgs(u);
      this._logger.info(`Running as non-root user, using sudo to install: ${a}`);
      let l = '"';
      return (/pkexec/i.test(a[0]) || a[0] === "sudo") && (l = ""), this.spawnSyncLog(a[0], [...a.length > 1 ? a.slice(1) : [], `${l}/bin/bash`, "-c", `'${c.join(" ")}'${l}`]);
    }
    sudoWithArgs(c) {
      const f = this.determineSudoCommand(), u = [f];
      return /kdesudo/i.test(f) ? (u.push("--comment", c), u.push("-c")) : /gksudo/i.test(f) ? u.push("--message", c) : /pkexec/i.test(f) && u.push("--disable-internal-agent"), u;
    }
    hasCommand(c) {
      try {
        return this.spawnSyncLog("command", ["-v", c]), !0;
      } catch {
        return !1;
      }
    }
    determineSudoCommand() {
      const c = ["gksudo", "kdesudo", "pkexec", "beesu"];
      for (const f of c)
        if (this.hasCommand(f))
          return f;
      return "sudo";
    }
    /**
     * Detects the package manager to use based on the available commands.
     * Allows overriding the default behavior by setting the ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER environment variable.
     * If the environment variable is set, it will be used directly. (This is useful for testing each package manager logic path.)
     * Otherwise, it checks for the presence of the specified package manager commands in the order provided.
     * @param pms - An array of package manager commands to check for, in priority order.
     * @returns The detected package manager command or "unknown" if none are found.
     */
    detectPackageManager(c) {
      var f;
      const u = (f = process.env.ELECTRON_BUILDER_LINUX_PACKAGE_MANAGER) === null || f === void 0 ? void 0 : f.trim();
      if (u)
        return u;
      for (const a of c)
        if (this.hasCommand(a))
          return a;
      return this._logger.warn(`No package manager found in the list: ${c.join(", ")}. Defaulting to the first one: ${c[0]}`), c[0];
    }
  };
  return cr.LinuxUpdater = d, cr;
}
var Tl;
function Sl() {
  if (Tl) return ur;
  Tl = 1, Object.defineProperty(ur, "__esModule", { value: !0 }), ur.DebUpdater = void 0;
  const t = Ve(), d = It(), p = ya();
  let c = class yu extends p.LinuxUpdater {
    constructor(u, a) {
      super(u, a);
    }
    /*** @private */
    doDownloadUpdate(u) {
      const a = u.updateInfoAndProvider.provider, l = (0, t.findFile)(a.resolveFiles(u.updateInfoAndProvider.info), "deb", ["AppImage", "rpm", "pacman"]);
      return this.executeDownload({
        fileExtension: "deb",
        fileInfo: l,
        downloadUpdateOptions: u,
        task: async (o, s) => {
          this.listenerCount(d.DOWNLOAD_PROGRESS) > 0 && (s.onProgress = (i) => this.emit(d.DOWNLOAD_PROGRESS, i)), await this.httpExecutor.download(l.url, o, s);
        }
      });
    }
    doInstall(u) {
      const a = this.installerPath;
      if (a == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      if (!this.hasCommand("dpkg") && !this.hasCommand("apt"))
        return this.dispatchError(new Error("Neither dpkg nor apt command found. Cannot install .deb package.")), !1;
      const l = ["dpkg", "apt"], o = this.detectPackageManager(l);
      try {
        yu.installWithCommandRunner(o, a, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (s) {
        return this.dispatchError(s), !1;
      }
      return u.isForceRunAfter && this.app.relaunch(), !0;
    }
    static installWithCommandRunner(u, a, l, o) {
      var s;
      if (u === "dpkg")
        try {
          l(["dpkg", "-i", a]);
        } catch (i) {
          o.warn((s = i.message) !== null && s !== void 0 ? s : i), o.warn("dpkg installation failed, trying to fix broken dependencies with apt-get"), l(["apt-get", "install", "-f", "-y"]);
        }
      else if (u === "apt")
        o.warn("Using apt to install a local .deb. This may fail for unsigned packages unless properly configured."), l([
          "apt",
          "install",
          "-y",
          "--allow-unauthenticated",
          // needed for unsigned .debs
          "--allow-downgrades",
          // allow lower version installs
          "--allow-change-held-packages",
          a
        ]);
      else
        throw new Error(`Package manager ${u} not supported`);
    }
  };
  return ur.DebUpdater = c, ur;
}
var fr = {}, Cl;
function bl() {
  if (Cl) return fr;
  Cl = 1, Object.defineProperty(fr, "__esModule", { value: !0 }), fr.PacmanUpdater = void 0;
  const t = It(), d = Ve(), p = ya();
  let c = class wu extends p.LinuxUpdater {
    constructor(u, a) {
      super(u, a);
    }
    /*** @private */
    doDownloadUpdate(u) {
      const a = u.updateInfoAndProvider.provider, l = (0, d.findFile)(a.resolveFiles(u.updateInfoAndProvider.info), "pacman", ["AppImage", "deb", "rpm"]);
      return this.executeDownload({
        fileExtension: "pacman",
        fileInfo: l,
        downloadUpdateOptions: u,
        task: async (o, s) => {
          this.listenerCount(t.DOWNLOAD_PROGRESS) > 0 && (s.onProgress = (i) => this.emit(t.DOWNLOAD_PROGRESS, i)), await this.httpExecutor.download(l.url, o, s);
        }
      });
    }
    doInstall(u) {
      const a = this.installerPath;
      if (a == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      try {
        wu.installWithCommandRunner(a, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (l) {
        return this.dispatchError(l), !1;
      }
      return u.isForceRunAfter && this.app.relaunch(), !0;
    }
    static installWithCommandRunner(u, a, l) {
      var o;
      try {
        a(["pacman", "-U", "--noconfirm", u]);
      } catch (s) {
        l.warn((o = s.message) !== null && o !== void 0 ? o : s), l.warn("pacman installation failed, attempting to update package database and retry");
        try {
          a(["pacman", "-Sy", "--noconfirm"]), a(["pacman", "-U", "--noconfirm", u]);
        } catch (i) {
          throw l.error("Retry after pacman -Sy failed"), i;
        }
      }
    }
  };
  return fr.PacmanUpdater = c, fr;
}
var dr = {}, Pl;
function Ol() {
  if (Pl) return dr;
  Pl = 1, Object.defineProperty(dr, "__esModule", { value: !0 }), dr.RpmUpdater = void 0;
  const t = It(), d = Ve(), p = ya();
  let c = class _u extends p.LinuxUpdater {
    constructor(u, a) {
      super(u, a);
    }
    /*** @private */
    doDownloadUpdate(u) {
      const a = u.updateInfoAndProvider.provider, l = (0, d.findFile)(a.resolveFiles(u.updateInfoAndProvider.info), "rpm", ["AppImage", "deb", "pacman"]);
      return this.executeDownload({
        fileExtension: "rpm",
        fileInfo: l,
        downloadUpdateOptions: u,
        task: async (o, s) => {
          this.listenerCount(t.DOWNLOAD_PROGRESS) > 0 && (s.onProgress = (i) => this.emit(t.DOWNLOAD_PROGRESS, i)), await this.httpExecutor.download(l.url, o, s);
        }
      });
    }
    doInstall(u) {
      const a = this.installerPath;
      if (a == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      const l = ["zypper", "dnf", "yum", "rpm"], o = this.detectPackageManager(l);
      try {
        _u.installWithCommandRunner(o, a, this.runCommandWithSudoIfNeeded.bind(this), this._logger);
      } catch (s) {
        return this.dispatchError(s), !1;
      }
      return u.isForceRunAfter && this.app.relaunch(), !0;
    }
    static installWithCommandRunner(u, a, l, o) {
      if (u === "zypper")
        return l(["zypper", "--non-interactive", "--no-refresh", "install", "--allow-unsigned-rpm", "-f", a]);
      if (u === "dnf")
        return l(["dnf", "install", "--nogpgcheck", "-y", a]);
      if (u === "yum")
        return l(["yum", "install", "--nogpgcheck", "-y", a]);
      if (u === "rpm")
        return o.warn("Installing with rpm only (no dependency resolution)."), l(["rpm", "-Uvh", "--replacepkgs", "--replacefiles", "--nodeps", a]);
      throw new Error(`Package manager ${u} not supported`);
    }
  };
  return dr.RpmUpdater = c, dr;
}
var hr = {}, Il;
function Dl() {
  if (Il) return hr;
  Il = 1, Object.defineProperty(hr, "__esModule", { value: !0 }), hr.MacUpdater = void 0;
  const t = Le(), d = /* @__PURE__ */ vt(), p = mt, c = Ie, f = _c, u = Ea(), a = Ve(), l = jr, o = Er;
  let s = class extends u.AppUpdater {
    constructor(r, n) {
      super(r, n), this.nativeUpdater = bt.autoUpdater, this.squirrelDownloadedUpdate = !1, this.nativeUpdater.on("error", (h) => {
        this._logger.warn(h), this.emit("error", h);
      }), this.nativeUpdater.on("update-downloaded", () => {
        this.squirrelDownloadedUpdate = !0, this.debug("nativeUpdater.update-downloaded");
      });
    }
    debug(r) {
      this._logger.debug != null && this._logger.debug(r);
    }
    closeServerIfExists() {
      this.server && (this.debug("Closing proxy server"), this.server.close((r) => {
        r && this.debug("proxy server wasn't already open, probably attempted closing again as a safety check before quit");
      }));
    }
    async doDownloadUpdate(r) {
      let n = r.updateInfoAndProvider.provider.resolveFiles(r.updateInfoAndProvider.info);
      const h = this._logger, g = "sysctl.proc_translated";
      let y = !1;
      try {
        this.debug("Checking for macOS Rosetta environment"), y = (0, l.execFileSync)("sysctl", [g], { encoding: "utf8" }).includes(`${g}: 1`), h.info(`Checked for macOS Rosetta environment (isRosetta=${y})`);
      } catch (b) {
        h.warn(`sysctl shell command to check for macOS Rosetta environment failed: ${b}`);
      }
      let m = !1;
      try {
        this.debug("Checking for arm64 in uname");
        const I = (0, l.execFileSync)("uname", ["-a"], { encoding: "utf8" }).includes("ARM");
        h.info(`Checked 'uname -a': arm64=${I}`), m = m || I;
      } catch (b) {
        h.warn(`uname shell command to check for arm64 failed: ${b}`);
      }
      m = m || process.arch === "arm64" || y;
      const _ = (b) => {
        var I;
        return b.url.pathname.includes("arm64") || ((I = b.info.url) === null || I === void 0 ? void 0 : I.includes("arm64"));
      };
      m && n.some(_) ? n = n.filter((b) => m === _(b)) : n = n.filter((b) => !_(b));
      const T = (0, a.findFile)(n, "zip", ["pkg", "dmg"]);
      if (T == null)
        throw (0, t.newError)(`ZIP file not provided: ${(0, t.safeStringifyJson)(n)}`, "ERR_UPDATER_ZIP_FILE_NOT_FOUND");
      const P = r.updateInfoAndProvider.provider, O = "update.zip";
      return this.executeDownload({
        fileExtension: "zip",
        fileInfo: T,
        downloadUpdateOptions: r,
        task: async (b, I) => {
          const S = c.join(this.downloadedUpdateHelper.cacheDir, O), A = () => (0, d.pathExistsSync)(S) ? !r.disableDifferentialDownload : (h.info("Unable to locate previous update.zip for differential download (is this first install?), falling back to full download"), !1);
          let v = !0;
          A() && (v = await this.differentialDownloadInstaller(T, r, b, P, O)), v && await this.httpExecutor.download(T.url, b, I);
        },
        done: async (b) => {
          if (!r.disableDifferentialDownload)
            try {
              const I = c.join(this.downloadedUpdateHelper.cacheDir, O);
              await (0, d.copyFile)(b.downloadedFile, I);
            } catch (I) {
              this._logger.warn(`Unable to copy file for caching for future differential downloads: ${I.message}`);
            }
          return this.updateDownloaded(T, b);
        }
      });
    }
    async updateDownloaded(r, n) {
      var h;
      const g = n.downloadedFile, y = (h = r.info.size) !== null && h !== void 0 ? h : (await (0, d.stat)(g)).size, m = this._logger, _ = `fileToProxy=${r.url.href}`;
      this.closeServerIfExists(), this.debug(`Creating proxy server for native Squirrel.Mac (${_})`), this.server = (0, f.createServer)(), this.debug(`Proxy server for native Squirrel.Mac is created (${_})`), this.server.on("close", () => {
        m.info(`Proxy server for native Squirrel.Mac is closed (${_})`);
      });
      const T = (P) => {
        const O = P.address();
        return typeof O == "string" ? O : `http://127.0.0.1:${O?.port}`;
      };
      return await new Promise((P, O) => {
        const b = (0, o.randomBytes)(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-"), I = Buffer.from(`autoupdater:${b}`, "ascii"), S = `/${(0, o.randomBytes)(64).toString("hex")}.zip`;
        this.server.on("request", (A, v) => {
          const k = A.url;
          if (m.info(`${k} requested`), k === "/") {
            if (!A.headers.authorization || A.headers.authorization.indexOf("Basic ") === -1) {
              v.statusCode = 401, v.statusMessage = "Invalid Authentication Credentials", v.end(), m.warn("No authenthication info");
              return;
            }
            const $ = A.headers.authorization.split(" ")[1], L = Buffer.from($, "base64").toString("ascii"), [N, j] = L.split(":");
            if (N !== "autoupdater" || j !== b) {
              v.statusCode = 401, v.statusMessage = "Invalid Authentication Credentials", v.end(), m.warn("Invalid authenthication credentials");
              return;
            }
            const D = Buffer.from(`{ "url": "${T(this.server)}${S}" }`);
            v.writeHead(200, { "Content-Type": "application/json", "Content-Length": D.length }), v.end(D);
            return;
          }
          if (!k.startsWith(S)) {
            m.warn(`${k} requested, but not supported`), v.writeHead(404), v.end();
            return;
          }
          m.info(`${S} requested by Squirrel.Mac, pipe ${g}`);
          let q = !1;
          v.on("finish", () => {
            q || (this.nativeUpdater.removeListener("error", O), P([]));
          });
          const x = (0, p.createReadStream)(g);
          x.on("error", ($) => {
            try {
              v.end();
            } catch (L) {
              m.warn(`cannot end response: ${L}`);
            }
            q = !0, this.nativeUpdater.removeListener("error", O), O(new Error(`Cannot pipe "${g}": ${$}`));
          }), v.writeHead(200, {
            "Content-Type": "application/zip",
            "Content-Length": y
          }), x.pipe(v);
        }), this.debug(`Proxy server for native Squirrel.Mac is starting to listen (${_})`), this.server.listen(0, "127.0.0.1", () => {
          this.debug(`Proxy server for native Squirrel.Mac is listening (address=${T(this.server)}, ${_})`), this.nativeUpdater.setFeedURL({
            url: T(this.server),
            headers: {
              "Cache-Control": "no-cache",
              Authorization: `Basic ${I.toString("base64")}`
            }
          }), this.dispatchUpdateDownloaded(n), this.autoInstallOnAppQuit ? (this.nativeUpdater.once("error", O), this.nativeUpdater.checkForUpdates()) : P([]);
        });
      });
    }
    handleUpdateDownloaded() {
      this.autoRunAppAfterInstall ? this.nativeUpdater.quitAndInstall() : this.app.quit(), this.closeServerIfExists();
    }
    quitAndInstall() {
      this.squirrelDownloadedUpdate ? this.handleUpdateDownloaded() : (this.nativeUpdater.on("update-downloaded", () => this.handleUpdateDownloaded()), this.autoInstallOnAppQuit || this.nativeUpdater.checkForUpdates());
    }
  };
  return hr.MacUpdater = s, hr;
}
var pr = {}, Mr = {}, Nl;
function ed() {
  if (Nl) return Mr;
  Nl = 1, Object.defineProperty(Mr, "__esModule", { value: !0 }), Mr.verifySignature = u;
  const t = Le(), d = jr, p = Gr, c = Ie;
  function f(s, i) {
    return ['set "PSModulePath=" & chcp 65001 >NUL & powershell.exe', ["-NoProfile", "-NonInteractive", "-InputFormat", "None", "-Command", s], {
      shell: !0,
      timeout: i
    }];
  }
  function u(s, i, r) {
    return new Promise((n, h) => {
      const g = i.replace(/'/g, "''");
      r.info(`Verifying signature ${g}`), (0, d.execFile)(...f(`"Get-AuthenticodeSignature -LiteralPath '${g}' | ConvertTo-Json -Compress"`, 20 * 1e3), (y, m, _) => {
        var T;
        try {
          if (y != null || _) {
            l(r, y, _, h), n(null);
            return;
          }
          const P = a(m);
          if (P.Status === 0) {
            try {
              const S = c.normalize(P.Path), A = c.normalize(i);
              if (r.info(`LiteralPath: ${S}. Update Path: ${A}`), S !== A) {
                l(r, new Error(`LiteralPath of ${S} is different than ${A}`), _, h), n(null);
                return;
              }
            } catch (S) {
              r.warn(`Unable to verify LiteralPath of update asset due to missing data.Path. Skipping this step of validation. Message: ${(T = S.message) !== null && T !== void 0 ? T : S.stack}`);
            }
            const b = (0, t.parseDn)(P.SignerCertificate.Subject);
            let I = !1;
            for (const S of s) {
              const A = (0, t.parseDn)(S);
              if (A.size ? I = Array.from(A.keys()).every((k) => A.get(k) === b.get(k)) : S === b.get("CN") && (r.warn(`Signature validated using only CN ${S}. Please add your full Distinguished Name (DN) to publisherNames configuration`), I = !0), I) {
                n(null);
                return;
              }
            }
          }
          const O = `publisherNames: ${s.join(" | ")}, raw info: ` + JSON.stringify(P, (b, I) => b === "RawData" ? void 0 : I, 2);
          r.warn(`Sign verification failed, installer signed with incorrect certificate: ${O}`), n(O);
        } catch (P) {
          l(r, P, null, h), n(null);
          return;
        }
      });
    });
  }
  function a(s) {
    const i = JSON.parse(s);
    delete i.PrivateKey, delete i.IsOSBinary, delete i.SignatureType;
    const r = i.SignerCertificate;
    return r != null && (delete r.Archived, delete r.Extensions, delete r.Handle, delete r.HasPrivateKey, delete r.SubjectName), i;
  }
  function l(s, i, r, n) {
    if (o()) {
      s.warn(`Cannot execute Get-AuthenticodeSignature: ${i || r}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
      return;
    }
    try {
      (0, d.execFileSync)(...f("ConvertTo-Json test", 10 * 1e3));
    } catch (h) {
      s.warn(`Cannot execute ConvertTo-Json: ${h.message}. Ignoring signature validation due to unsupported powershell version. Please upgrade to powershell 3 or higher.`);
      return;
    }
    i != null && n(i), r && n(new Error(`Cannot execute Get-AuthenticodeSignature, stderr: ${r}. Failing signature validation due to unknown stderr.`));
  }
  function o() {
    const s = p.release();
    return s.startsWith("6.") && !s.startsWith("6.3");
  }
  return Mr;
}
var Fl;
function Ll() {
  if (Fl) return pr;
  Fl = 1, Object.defineProperty(pr, "__esModule", { value: !0 }), pr.NsisUpdater = void 0;
  const t = Le(), d = Ie, p = Zr(), c = Eu(), f = It(), u = Ve(), a = /* @__PURE__ */ vt(), l = ed(), o = gt;
  let s = class extends p.BaseUpdater {
    constructor(r, n) {
      super(r, n), this._verifyUpdateCodeSignature = (h, g) => (0, l.verifySignature)(h, g, this._logger);
    }
    /**
     * The verifyUpdateCodeSignature. You can pass [win-verify-signature](https://github.com/beyondkmp/win-verify-trust) or another custom verify function: ` (publisherName: string[], path: string) => Promise<string | null>`.
     * The default verify function uses [windowsExecutableCodeSignatureVerifier](https://github.com/electron-userland/electron-builder/blob/master/packages/electron-updater/src/windowsExecutableCodeSignatureVerifier.ts)
     */
    get verifyUpdateCodeSignature() {
      return this._verifyUpdateCodeSignature;
    }
    set verifyUpdateCodeSignature(r) {
      r && (this._verifyUpdateCodeSignature = r);
    }
    /*** @private */
    doDownloadUpdate(r) {
      const n = r.updateInfoAndProvider.provider, h = (0, u.findFile)(n.resolveFiles(r.updateInfoAndProvider.info), "exe");
      return this.executeDownload({
        fileExtension: "exe",
        downloadUpdateOptions: r,
        fileInfo: h,
        task: async (g, y, m, _) => {
          const T = h.packageInfo, P = T != null && m != null;
          if (P && r.disableWebInstaller)
            throw (0, t.newError)(`Unable to download new version ${r.updateInfoAndProvider.info.version}. Web Installers are disabled`, "ERR_UPDATER_WEB_INSTALLER_DISABLED");
          !P && !r.disableWebInstaller && this._logger.warn("disableWebInstaller is set to false, you should set it to true if you do not plan on using a web installer. This will default to true in a future version."), (P || r.disableDifferentialDownload || await this.differentialDownloadInstaller(h, r, g, n, t.CURRENT_APP_INSTALLER_FILE_NAME)) && await this.httpExecutor.download(h.url, g, y);
          const O = await this.verifySignature(g);
          if (O != null)
            throw await _(), (0, t.newError)(`New version ${r.updateInfoAndProvider.info.version} is not signed by the application owner: ${O}`, "ERR_UPDATER_INVALID_SIGNATURE");
          if (P && await this.differentialDownloadWebPackage(r, T, m, n))
            try {
              await this.httpExecutor.download(new o.URL(T.path), m, {
                headers: r.requestHeaders,
                cancellationToken: r.cancellationToken,
                sha512: T.sha512
              });
            } catch (b) {
              try {
                await (0, a.unlink)(m);
              } catch {
              }
              throw b;
            }
        }
      });
    }
    // $certificateInfo = (Get-AuthenticodeSignature 'xxx\yyy.exe'
    // | where {$_.Status.Equals([System.Management.Automation.SignatureStatus]::Valid) -and $_.SignerCertificate.Subject.Contains("CN=siemens.com")})
    // | Out-String ; if ($certificateInfo) { exit 0 } else { exit 1 }
    async verifySignature(r) {
      let n;
      try {
        if (n = (await this.configOnDisk.value).publisherName, n == null)
          return null;
      } catch (h) {
        if (h.code === "ENOENT")
          return null;
        throw h;
      }
      return await this._verifyUpdateCodeSignature(Array.isArray(n) ? n : [n], r);
    }
    doInstall(r) {
      const n = this.installerPath;
      if (n == null)
        return this.dispatchError(new Error("No update filepath provided, can't quit and install")), !1;
      const h = ["--updated"];
      r.isSilent && h.push("/S"), r.isForceRunAfter && h.push("--force-run"), this.installDirectory && h.push(`/D=${this.installDirectory}`);
      const g = this.downloadedUpdateHelper == null ? null : this.downloadedUpdateHelper.packageFile;
      g != null && h.push(`--package-file=${g}`);
      const y = () => {
        this.spawnLog(d.join(process.resourcesPath, "elevate.exe"), [n].concat(h)).catch((m) => this.dispatchError(m));
      };
      return r.isAdminRightsRequired ? (this._logger.info("isAdminRightsRequired is set to true, run installer using elevate.exe"), y(), !0) : (this.spawnLog(n, h).catch((m) => {
        const _ = m.code;
        this._logger.info(`Cannot run installer: error code: ${_}, error message: "${m.message}", will be executed again using elevate if EACCES, and will try to use electron.shell.openItem if ENOENT`), _ === "UNKNOWN" || _ === "EACCES" ? y() : _ === "ENOENT" ? bt.shell.openPath(n).catch((T) => this.dispatchError(T)) : this.dispatchError(m);
      }), !0);
    }
    async differentialDownloadWebPackage(r, n, h, g) {
      if (n.blockMapSize == null)
        return !0;
      try {
        const y = {
          newUrl: new o.URL(n.path),
          oldFile: d.join(this.downloadedUpdateHelper.cacheDir, t.CURRENT_APP_PACKAGE_FILE_NAME),
          logger: this._logger,
          newFile: h,
          requestHeaders: this.requestHeaders,
          isUseMultipleRangeRequest: g.isUseMultipleRangeRequest,
          cancellationToken: r.cancellationToken
        };
        this.listenerCount(f.DOWNLOAD_PROGRESS) > 0 && (y.onProgress = (m) => this.emit(f.DOWNLOAD_PROGRESS, m)), await new c.FileWithEmbeddedBlockMapDifferentialDownloader(n, this.httpExecutor, y).download();
      } catch (y) {
        return this._logger.error(`Cannot download differentially, fallback to full download: ${y.stack || y}`), process.platform === "win32";
      }
      return !1;
    }
  };
  return pr.NsisUpdater = s, pr;
}
var xl;
function td() {
  return xl || (xl = 1, (function(t) {
    var d = At && At.__createBinding || (Object.create ? (function(m, _, T, P) {
      P === void 0 && (P = T);
      var O = Object.getOwnPropertyDescriptor(_, T);
      (!O || ("get" in O ? !_.__esModule : O.writable || O.configurable)) && (O = { enumerable: !0, get: function() {
        return _[T];
      } }), Object.defineProperty(m, P, O);
    }) : (function(m, _, T, P) {
      P === void 0 && (P = T), m[P] = _[T];
    })), p = At && At.__exportStar || function(m, _) {
      for (var T in m) T !== "default" && !Object.prototype.hasOwnProperty.call(_, T) && d(_, m, T);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.NsisUpdater = t.MacUpdater = t.RpmUpdater = t.PacmanUpdater = t.DebUpdater = t.AppImageUpdater = t.Provider = t.NoOpLogger = t.AppUpdater = t.BaseUpdater = void 0;
    const c = /* @__PURE__ */ vt(), f = Ie;
    var u = Zr();
    Object.defineProperty(t, "BaseUpdater", { enumerable: !0, get: function() {
      return u.BaseUpdater;
    } });
    var a = Ea();
    Object.defineProperty(t, "AppUpdater", { enumerable: !0, get: function() {
      return a.AppUpdater;
    } }), Object.defineProperty(t, "NoOpLogger", { enumerable: !0, get: function() {
      return a.NoOpLogger;
    } });
    var l = Ve();
    Object.defineProperty(t, "Provider", { enumerable: !0, get: function() {
      return l.Provider;
    } });
    var o = Rl();
    Object.defineProperty(t, "AppImageUpdater", { enumerable: !0, get: function() {
      return o.AppImageUpdater;
    } });
    var s = Sl();
    Object.defineProperty(t, "DebUpdater", { enumerable: !0, get: function() {
      return s.DebUpdater;
    } });
    var i = bl();
    Object.defineProperty(t, "PacmanUpdater", { enumerable: !0, get: function() {
      return i.PacmanUpdater;
    } });
    var r = Ol();
    Object.defineProperty(t, "RpmUpdater", { enumerable: !0, get: function() {
      return r.RpmUpdater;
    } });
    var n = Dl();
    Object.defineProperty(t, "MacUpdater", { enumerable: !0, get: function() {
      return n.MacUpdater;
    } });
    var h = Ll();
    Object.defineProperty(t, "NsisUpdater", { enumerable: !0, get: function() {
      return h.NsisUpdater;
    } }), p(It(), t);
    let g;
    function y() {
      if (process.platform === "win32")
        g = new (Ll()).NsisUpdater();
      else if (process.platform === "darwin")
        g = new (Dl()).MacUpdater();
      else {
        g = new (Rl()).AppImageUpdater();
        try {
          const m = f.join(process.resourcesPath, "package-type");
          if (!(0, c.existsSync)(m))
            return g;
          switch ((0, c.readFileSync)(m).toString().trim()) {
            case "deb":
              g = new (Sl()).DebUpdater();
              break;
            case "rpm":
              g = new (Ol()).RpmUpdater();
              break;
            case "pacman":
              g = new (bl()).PacmanUpdater();
              break;
            default:
              break;
          }
        } catch (m) {
          console.warn("Unable to detect 'package-type' for autoUpdater (rpm/deb/pacman support). If you'd like to expand support, please consider contributing to electron-builder", m.message);
        }
      }
      return g;
    }
    Object.defineProperty(t, "autoUpdater", {
      enumerable: !0,
      get: () => g || y()
    });
  })(At)), At;
}
var pt = td();
const rd = Sc(import.meta.url), wa = Rc(rd), en = /* @__PURE__ */ new Set(), nd = () => {
  const t = bc();
  return Pc === "win32" ? Xe(t, "AppData", "LocalLow", "Notepad Flux") : Xe(t, ".config", "notepad-flux");
}, Ru = nd();
Mt.setPath("userData", Ru);
en.add(Wr(Ru));
const Au = (t) => {
  if (!t || typeof t != "string") return !1;
  const d = Wr(t);
  if (!Ac(d) || t.includes("..")) return !1;
  for (const p of en)
    if (d === p || d.startsWith(p + Tc))
      return !0;
  return !1;
}, Dt = (t, d) => {
  Ec.handle(t, async (p, ...c) => {
    try {
      return await d(p, ...c);
    } catch (f) {
      throw console.error(`Error in IPC handler for ${t}:`, f), new Error("An internal system error occurred. Please try again.", { cause: f });
    }
  });
};
Dt("safe-storage-encrypt", async (t, d) => {
  if (!gr.isEncryptionAvailable())
    throw new Error("Safe storage is not available.");
  return gr.encryptString(d).toString("base64");
});
Dt("safe-storage-decrypt", async (t, d) => {
  if (!gr.isEncryptionAvailable())
    throw new Error("Safe storage is not available.");
  const p = Buffer.from(d, "base64");
  return gr.decryptString(p);
});
Dt("safe-storage-available", async () => gr.isEncryptionAvailable());
Dt("read-file", async () => {
  const { canceled: t, filePaths: d } = await Hr.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });
  if (t) return { canceled: t };
  const p = d[0];
  en.add(Wr(p));
  const c = await Ml(p, "utf-8");
  return { canceled: t, filePath: p, content: c };
});
Dt("read-file-content", async (t, d) => {
  if (!Au(d))
    throw new Error("Access denied: Unauthorized file path.");
  return await Ml(d, "utf-8");
});
Dt("save-file", async (t, { filePath: d, content: p }) => {
  if (d) {
    if (!Au(d))
      throw new Error("Access denied: Unauthorized file path.");
  } else {
    const { canceled: c, filePath: f } = await Hr.showSaveDialog({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (c) return { canceled: !0 };
    d = f, en.add(Wr(d));
  }
  return await Cc(d, p, "utf-8"), { filePath: d };
});
pt.autoUpdater.autoDownload = !1;
pt.autoUpdater.autoInstallOnAppQuit = !0;
pt.autoUpdater.on("update-available", async (t) => {
  const { response: d } = await Hr.showMessageBox({
    type: "info",
    buttons: ["Download Now", "Later"],
    title: "Update Available",
    message: `A new version (${t.version}) of Notepad Flux is available. Would you like to download it now?`
  });
  d === 0 && pt.autoUpdater.downloadUpdate();
});
pt.autoUpdater.on("update-downloaded", async (t) => {
  const { response: d } = await Hr.showMessageBox({
    type: "info",
    buttons: ["Restart and Install", "Later"],
    title: "Update Ready",
    message: "The update has been downloaded and is ready to be installed. Would you like to restart the application now?"
  });
  d === 0 && pt.autoUpdater.quitAndInstall();
});
pt.autoUpdater.on("error", (t) => {
  console.error("Auto Updater error:", t);
});
Dt("get-app-version", async () => Mt.getVersion());
process.env.DIST_ELECTRON = Xe(wa, "../dist-electron");
process.env.DIST = Xe(wa, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? Xe(wa, "../public") : process.env.DIST;
let st = null, Br = null;
function Tu() {
  st = new na({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: !1,
    // Wait until ready-to-show
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      // Transparent background
      symbolColor: "#64748b",
      // Slate-500 matches UI usually, or use theme color
      height: 40
      // Match tab height
    },
    backgroundMaterial: "mica",
    icon: Xe(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
    webPreferences: {
      preload: Xe(process.env.DIST_ELECTRON, "preload.js"),
      nodeIntegration: !1,
      contextIsolation: !0,
      sandbox: !0
    }
  }), st.webContents.setWindowOpenHandler(() => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: "#00000000",
        symbolColor: "#64748b",
        height: 40
      },
      backgroundMaterial: "mica",
      icon: Xe(process.env.VITE_PUBLIC, "icons/desktop/icon.png"),
      webPreferences: {
        preload: Xe(process.env.DIST_ELECTRON, "preload.js"),
        sandbox: !0
      }
    }
  })), st.once("ready-to-show", () => {
    st.show(), Br && Br.close();
  }), yc.setApplicationMenu(null), st.webContents.on("did-finish-load", () => {
    st?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), process.env.VITE_DEV_SERVER_URL ? st.loadURL(process.env.VITE_DEV_SERVER_URL) : st.loadFile(Xe(process.env.DIST, "index.html"));
}
Mt.on("window-all-closed", () => {
  st = null, process.platform !== "darwin" && Mt.quit();
});
Mt.on("activate", () => {
  na.getAllWindows().length === 0 && Tu();
});
Mt.whenReady().then(() => {
  Br = new na({
    width: 300,
    height: 300,
    transparent: !0,
    frame: !1,
    alwaysOnTop: !0,
    icon: Xe(process.env.VITE_PUBLIC, "icons/desktop/icon.png")
  }), Br.loadFile(Xe(process.env.VITE_PUBLIC, "loading.html")), Tu(), process.env.VITE_DEV_SERVER_URL || pt.autoUpdater.checkForUpdates().catch((t) => {
    console.error("Failed to check for updates:", t);
  });
});
