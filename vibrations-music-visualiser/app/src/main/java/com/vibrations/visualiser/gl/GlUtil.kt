package com.vibrations.visualiser.gl

import android.content.Context
import android.opengl.GLES30
import android.opengl.GLSurfaceView
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLDisplay

fun loadAsset(context: Context, path: String): String =
    context.assets.open(path).bufferedReader().use { it.readText() }

class GlException(msg: String) : RuntimeException(msg)

class Program(vs: String, fs: String) {
    val id: Int
    private val locs = HashMap<String, Int>()

    init {
        val v = compile(GLES30.GL_VERTEX_SHADER, "#version 300 es\n$vs")
        val f = compile(GLES30.GL_FRAGMENT_SHADER, "#version 300 es\n$fs")
        id = GLES30.glCreateProgram()
        GLES30.glAttachShader(id, v)
        GLES30.glAttachShader(id, f)
        GLES30.glLinkProgram(id)
        val ok = IntArray(1)
        GLES30.glGetProgramiv(id, GLES30.GL_LINK_STATUS, ok, 0)
        GLES30.glDeleteShader(v); GLES30.glDeleteShader(f)
        if (ok[0] == 0) {
            val log = GLES30.glGetProgramInfoLog(id)
            GLES30.glDeleteProgram(id)
            throw GlException("link failed: $log")
        }
    }

    private fun compile(type: Int, src: String): Int {
        val s = GLES30.glCreateShader(type)
        GLES30.glShaderSource(s, src)
        GLES30.glCompileShader(s)
        val ok = IntArray(1)
        GLES30.glGetShaderiv(s, GLES30.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) {
            val log = GLES30.glGetShaderInfoLog(s)
            GLES30.glDeleteShader(s)
            throw GlException("compile failed: $log")
        }
        return s
    }

    fun use() = GLES30.glUseProgram(id)
    fun loc(name: String): Int = locs.getOrPut(name) { GLES30.glGetUniformLocation(id, name) }
    fun f(name: String, v: Float) = GLES30.glUniform1f(loc(name), v)
    fun f2(name: String, a: Float, b: Float) = GLES30.glUniform2f(loc(name), a, b)
    fun f3(name: String, a: Float, b: Float, c: Float) = GLES30.glUniform3f(loc(name), a, b, c)
    fun i(name: String, v: Int) = GLES30.glUniform1i(loc(name), v)
    fun fv(name: String, v: FloatArray) = GLES30.glUniform1fv(loc(name), v.size, v, 0)
    fun f3v(name: String, v: FloatArray) = GLES30.glUniform3fv(loc(name), v.size / 3, v, 0)
    fun release() = GLES30.glDeleteProgram(id)
}

/** A colour texture + framebuffer. */
class Target(val w: Int, val h: Int, val hdr: Boolean) {
    val tex: Int
    val fbo: Int

    init {
        val t = IntArray(1)
        GLES30.glGenTextures(1, t, 0)
        tex = t[0]
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
        if (hdr) GLES30.glTexImage2D(GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA16F, w, h, 0, GLES30.GL_RGBA, GLES30.GL_HALF_FLOAT, null)
        else GLES30.glTexImage2D(GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA8, w, h, 0, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, null)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glGenFramebuffers(1, t, 0)
        fbo = t[0]
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo)
        GLES30.glFramebufferTexture2D(GLES30.GL_FRAMEBUFFER, GLES30.GL_COLOR_ATTACHMENT0, GLES30.GL_TEXTURE_2D, tex, 0)
        val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
        GLES30.glClearColor(0f, 0f, 0f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        if (status != GLES30.GL_FRAMEBUFFER_COMPLETE) {
            release()
            throw GlException("framebuffer incomplete ($status)")
        }
    }

    /** Builds the mip chain (used for thick neon lines and soft art sampling). */
    fun mipmap() {
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
        GLES30.glGenerateMipmap(GLES30.GL_TEXTURE_2D)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR_MIPMAP_LINEAR)
    }

    fun bind() {
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo)
        GLES30.glViewport(0, 0, w, h)
    }

    fun release() {
        GLES30.glDeleteTextures(1, intArrayOf(tex), 0)
        GLES30.glDeleteFramebuffers(1, intArrayOf(fbo), 0)
    }
}

/** Picks an RGBA8888 ES3 config that can also feed a MediaCodec input surface. */
class RecordableConfigChooser : GLSurfaceView.EGLConfigChooser {
    companion object {
        private const val EGL_OPENGL_ES3_BIT = 0x40
        private const val EGL_RECORDABLE_ANDROID = 0x3142
    }

    override fun chooseConfig(egl: EGL10, display: EGLDisplay): EGLConfig {
        val attempts = listOf(
            intArrayOf(EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8, EGL10.EGL_ALPHA_SIZE, 8,
                EGL10.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT, EGL_RECORDABLE_ANDROID, 1, EGL10.EGL_NONE),
            intArrayOf(EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8, EGL10.EGL_ALPHA_SIZE, 8,
                EGL10.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT, EGL10.EGL_NONE),
        )
        for (attrs in attempts) {
            val num = IntArray(1)
            val configs = arrayOfNulls<EGLConfig>(16)
            if (!egl.eglChooseConfig(display, attrs, configs, configs.size, num) || num[0] == 0) continue
            val v = IntArray(1)
            for (i in 0 until num[0]) {
                val c = configs[i] ?: continue
                fun attr(a: Int): Int { egl.eglGetConfigAttrib(display, c, a, v); return v[0] }
                if (attr(EGL10.EGL_RED_SIZE) == 8 && attr(EGL10.EGL_GREEN_SIZE) == 8 &&
                    attr(EGL10.EGL_BLUE_SIZE) == 8 && attr(EGL10.EGL_ALPHA_SIZE) == 8) return c
            }
            configs[0]?.let { return it }
        }
        throw IllegalStateException("No OpenGL ES 3 config available")
    }
}
