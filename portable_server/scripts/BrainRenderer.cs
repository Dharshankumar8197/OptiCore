#pragma warning disable 0168, 0219, 0414, 0169, 0649
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class BrainRenderer
{
    // model points + normals
    double[] px, py, pz, nx, ny, nz, ao;
    int[] part;
    int n;

    // per-frame view-space copies
    double[] tx, ty, tz, tnx, tny, tnz;
    int[] cell;

    // shadow map
    const int SM = 150;
    double[] smap = new double[SM * SM];

    // frame buffers
    int W = -1, BH = 0;
    double[] zbuf, bright;
    int[] cpart;


    const string Ramp = ".'`,:;+*oO0";
    static readonly int[][] Pals = new int[][] {
        new int[] { 17, 18, 24, 25, 31, 32, 33, 38, 39, 45, 81, 117, 159 },   // blue (upper / frontal)
        new int[] { 23, 23, 24, 30, 30, 36, 37, 43, 44, 50, 86, 122, 159 },   // teal (middle)
        new int[] { 22, 28, 29, 35, 36, 42, 48, 49, 78, 85, 121, 157, 194 }   // green (lower)
    };
    double[] rnd;
    int[] hue;

    static int HueOf(double z, double r, int pt)
    {
        if (pt != 0) return 2;
        double hv = z + (r - 0.5) * 0.55;
        if (hv > 0.50) return 0;
        if (hv > 0.00) return 1;
        return 2;
    }

    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int h);
    [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr h, out int m);
    [DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr h, int m);

    public static void EnableVT()
    {
        try
        {
            IntPtr h = GetStdHandle(-11);
            int m;
            if (GetConsoleMode(h, out m)) SetConsoleMode(h, m | 4);
        }
        catch (Exception) { }
    }

    static double Clamp(double v, double lo, double hi)
    {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    // Surface of cerebrum (part 0) or cerebellum (part 1) for a unit direction
    static void Surf(int part, double dx, double dy, double dz,
                     out double x, out double y, out double z, out double a)
    {
        if (part == 0)
        {
            double n1 = Math.Sin(11 * dx + 3 * dy + 1.0) + Math.Sin(10 * dy - 6 * dz + 2.0) + Math.Sin(12 * dz + 4 * dx);
            double n2 = Math.Sin(21 * dx + 9 * dz) + Math.Sin(19 * dy + 7 * dx + 0.7) + Math.Sin(23 * dz - 5 * dy);
            double n3 = Math.Sin(37 * dx + 13 * dy) + Math.Sin(33 * dz - 17 * dx + 1.1) + Math.Sin(41 * dy + 11 * dz);
            double g = 0.07 * Math.Min(Math.Abs(n1), 1.2) + 0.026 * Math.Min(Math.Abs(n2), 1.2) + 0.010 * Math.Min(Math.Abs(n3), 1.2);

            // longitudinal fissure
            double s = Clamp((dz + 0.45) / 0.45, 0.0, 1.0);
            double fis = 0.22 * Math.Exp(-(dy * dy) / 0.004) * s;

            // temporal lobe bulge on the lower sides
            double lat = Clamp(Math.Abs(dy) - 0.25, 0.0, 1.0);
            double tb = 0.16 * Math.Exp(-((dz + 0.55) * (dz + 0.55)) / 0.05)
                             * Math.Exp(-((dx - 0.2) * (dx - 0.2)) / 0.30) * lat;

            // sylvian fissure: groove running up and back across each side
            double sy = dz - (-0.10 + 0.35 * (0.2 - dx));
            double syl = 0.10 * Math.Exp(-(sy * sy) / 0.004) * lat * Clamp((dx + 0.4) / 0.4, 0.0, 1.0);

            double r = 1.0 + g - fis + tb - syl;
            double zz = dz * r;
            if (zz < 0) zz *= 0.62;
            double yfac = 0.88 + 0.12 * Clamp((dx + 1.0) / 1.4, 0.0, 1.0);
            x = 1.35 * dx * r;
            y = 0.95 * yfac * dy * r;
            z = 0.85 * zz + 0.15;
            a = Clamp(g / 0.11 - fis * 4.0 - syl * 3.0, 0.0, 1.0);
        }
        else
        {
            double g = 0.06 * Math.Abs(Math.Sin(46 * dz + 3 * dx));
            double r = 1.0 + g;
            x = -0.80 + 0.45 * dx * r;
            y = 0.55 * dy * r;
            z = -0.42 + 0.26 * dz * r;
            a = Clamp(g / 0.06, 0.0, 1.0);
        }
    }

    public BrainRenderer()
    {
        List<double> lx = new List<double>(), ly = new List<double>(), lz = new List<double>();
        List<double> lnx = new List<double>(), lny = new List<double>(), lnz = new List<double>();
        List<double> lao = new List<double>();
        List<int> lp = new List<int>();
        List<double> lrnd = new List<double>();
        List<int> lhue = new List<int>();
        Random rng = new Random(7);

        double golden = 2.399963;

        for (int pt = 0; pt < 2; pt++)
        {
            int N = (pt == 0) ? 14000 : 2400;
            for (int i = 0; i < N; i++)
            {
                double dzv = 1.0 - 2.0 * (i + 0.5) / N;
                double rr = Math.Sqrt(1.0 - dzv * dzv);
                double th = i * golden;
                double dxv = rr * Math.Cos(th);
                double dyv = rr * Math.Sin(th);

                double x, y, z, a;
                Surf(pt, dxv, dyv, dzv, out x, out y, out z, out a);

                // tangent basis for finite-difference normal
                double hx = 0, hy = 0, hz = 0;
                if (Math.Abs(dzv) < 0.9) hz = 1.0; else hx = 1.0;
                double t1x = dyv * hz - dzv * hy;
                double t1y = dzv * hx - dxv * hz;
                double t1z = dxv * hy - dyv * hx;
                double tl = Math.Sqrt(t1x * t1x + t1y * t1y + t1z * t1z);
                t1x /= tl; t1y /= tl; t1z /= tl;
                double t2x = dyv * t1z - dzv * t1y;
                double t2y = dzv * t1x - dxv * t1z;
                double t2z = dxv * t1y - dyv * t1x;

                double e = 0.012;
                double ax = dxv + e * t1x, ay = dyv + e * t1y, az = dzv + e * t1z;
                double al = Math.Sqrt(ax * ax + ay * ay + az * az);
                ax /= al; ay /= al; az /= al;
                double bx = dxv + e * t2x, by = dyv + e * t2y, bz = dzv + e * t2z;
                double bl = Math.Sqrt(bx * bx + by * by + bz * bz);
                bx /= bl; by /= bl; bz /= bl;

                double x1, y1, z1, x2, y2, z2, dummy;
                Surf(pt, ax, ay, az, out x1, out y1, out z1, out dummy);
                Surf(pt, bx, by, bz, out x2, out y2, out z2, out dummy);

                double ux = x1 - x, uy = y1 - y, uz = z1 - z;
                double vx = x2 - x, vy = y2 - y, vz = z2 - z;
                double cx = uy * vz - uz * vy;
                double cy = uz * vx - ux * vz;
                double cz = ux * vy - uy * vx;
                double cl = Math.Sqrt(cx * cx + cy * cy + cz * cz);
                if (cl < 1e-12) continue;
                cx /= cl; cy /= cl; cz /= cl;
                if (cx * dxv + cy * dyv + cz * dzv < 0) { cx = -cx; cy = -cy; cz = -cz; }

                lx.Add(x); ly.Add(y); lz.Add(z);
                lnx.Add(cx); lny.Add(cy); lnz.Add(cz);
                lao.Add(a); lp.Add(pt);
                double rv = rng.NextDouble();
                lrnd.Add(rv); lhue.Add(HueOf(z, rv, pt));
            }
        }

        // brain stem
        int NS = 600;
        for (int i = 0; i < NS; i++)
        {
            double t = (i + 0.5) / NS;
            double th = i * golden;
            double cxs = -0.25 - 0.15 * t;
            double czs = -0.25 - 0.80 * t;
            double rad = 0.17 - 0.05 * t;
            lx.Add(cxs + rad * Math.Cos(th));
            ly.Add(rad * Math.Sin(th));
            lz.Add(czs);
            lnx.Add(Math.Cos(th)); lny.Add(Math.Sin(th)); lnz.Add(0.0);
            lao.Add(0.7); lp.Add(2);
            lrnd.Add(rng.NextDouble()); lhue.Add(2);
        }

        px = lx.ToArray(); py = ly.ToArray(); pz = lz.ToArray();
        nx = lnx.ToArray(); ny = lny.ToArray(); nz = lnz.ToArray();
        ao = lao.ToArray(); part = lp.ToArray();
        rnd = lrnd.ToArray(); hue = lhue.ToArray();
        n = px.Length;

        tx = new double[n]; ty = new double[n]; tz = new double[n];
        tnx = new double[n]; tny = new double[n]; tnz = new double[n];
        cell = new int[n];
    }

    public string Render(double time, int w, int h, int topRow = 3, int bottomMargin = 1, string headerText = "Opticore AI Server", string subHeaderText = "", string bottomText = "")
    {
        StringBuilder sb = new StringBuilder(w * h * 6);

        int maxRow = Math.Max(topRow + 4, h - bottomMargin);
        int bh = maxRow - topRow;


        if (w != W || bh != BH)
        {
            W = w; BH = bh;
            zbuf = new double[W * BH];
            bright = new double[W * BH];
            cpart = new int[W * BH];
            sb.Append("\u001b[2J");
        }
        for (int i = 0; i < zbuf.Length; i++) { zbuf[i] = double.MaxValue; bright[i] = 0; }

        double ang = 1.2 * Math.Sin(time * 0.25);
        double ca = Math.Cos(ang), sa = Math.Sin(ang);
        double ct = Math.Cos(0.18), st = Math.Sin(0.18);

        // light direction (towards the light), view space: left, up, toward camera
        double lxv = -0.6, lyv = 0.7, lzv = -0.6;
        double ll = Math.Sqrt(lxv * lxv + lyv * lyv + lzv * lzv);
        lxv /= ll; lyv /= ll; lzv /= ll;

        // light-space basis for the shadow map
        double ux = -lzv, uy = 0.0, uz = lxv;
        double ul = Math.Sqrt(ux * ux + uz * uz);
        ux /= ul; uz /= ul;
        double vx = lyv * uz - lzv * uy;
        double vy = lzv * ux - lxv * uz;
        double vz = lxv * uy - lyv * ux;

        // half vector for specular
        double hx = lxv, hy = lyv, hz = lzv - 1.0;
        double hl = Math.Sqrt(hx * hx + hy * hy + hz * hz);
        hx /= hl; hy /= hl; hz /= hl;

        for (int i = 0; i < smap.Length; i++) smap[i] = -1e9;

        // pass 1: rotate, build shadow map
        for (int i = 0; i < n; i++)
        {
            double x = px[i], y = py[i], z = pz[i];
            double xr = x * ca - y * sa;
            double yr = x * sa + y * ca;
            tx[i] = xr;
            ty[i] = z * ct + yr * st;
            tz[i] = -z * st + yr * ct;

            double nxr = nx[i] * ca - ny[i] * sa;
            double nyr = nx[i] * sa + ny[i] * ca;
            tnx[i] = nxr;
            tny[i] = nz[i] * ct + nyr * st;
            tnz[i] = -nz[i] * st + nyr * ct;

            double a = tx[i] * ux + ty[i] * uy + tz[i] * uz;
            double b = tx[i] * vx + ty[i] * vy + tz[i] * vz;
            double c = tx[i] * lxv + ty[i] * lyv + tz[i] * lzv;
            int ia = (int)((a + 2.4) * (SM / 4.8));
            int ib = (int)((b + 2.4) * (SM / 4.8));
            if (ia < 0) ia = 0; if (ia >= SM) ia = SM - 1;
            if (ib < 0) ib = 0; if (ib >= SM) ia = SM - 1;
            if (ib >= SM) ib = SM - 1;
            int ci = ib * SM + ia;
            cell[i] = ci;
            if (c > smap[ci]) smap[ci] = c;
        }

        double unit = Math.Min(BH / 2.7, W / 5.2);

        // pass 2: shade + project
        for (int i = 0; i < n; i++)
        {
            bool back = tnz[i] > 0.3;
            if (back && rnd[i] > 0.15) continue;

            double c = tx[i] * lxv + ty[i] * lyv + tz[i] * lzv;
            bool lit = c >= smap[cell[i]] - 0.06;

            double diff = tnx[i] * lxv + tny[i] * lyv + tnz[i] * lzv;
            if (diff < 0) diff = 0;

            double b = 0.18 + 0.78 * diff * (lit ? 1.0 : 0.35);
            if (lit && diff > 0)
            {
                double sp = tnx[i] * hx + tny[i] * hy + tnz[i] * hz;
                if (sp > 0) b += 0.25 * Math.Pow(sp, 20.0);
            }
            double facing = -tnz[i];
            if (facing < 0) facing = 0;
            b += 0.18 * Math.Pow(1.0 - facing, 3.0);
            b *= 0.30 + 0.70 * ao[i];

            // travelling neural signal pulse
            double p = Math.Sin(px[i] * 3.5 - time * 2.5);
            if (p > 0 && part[i] != 2) b += 0.45 * Math.Pow(p, 10.0);

            b = Math.Pow(Clamp(b, 0.0, 1.0), 0.85);
            if (back) b *= 0.35;
            double tw = Math.Sin(time * 2.2 + rnd[i] * 40.0);
            if (tw > 0) b += 0.25 * Math.Pow(tw, 8.0);
            b = Clamp(b, 0.0, 1.0);
            if (b * 1.25 + 0.12 < rnd[i]) continue;

            double s = 4.6 / (4.6 + tz[i]);
            int sx = (int)(W / 2.0 + tx[i] * s * unit * 2.0);
            int sy = (int)(BH / 2.0 - ty[i] * s * unit);
            if (sx < 0 || sx >= W || sy < 0 || sy >= BH) continue;

            int idx = sy * W + sx;
            if (tz[i] < zbuf[idx])
            {
                zbuf[idx] = tz[i];
                bright[idx] = b;
                cpart[idx] = hue[i];
            }
        }

        // output
        sb.Append("\u001b[40m\u001b[?25l");
        if (topRow >= 2 && !string.IsNullOrEmpty(headerText))
        {
            sb.Append("\u001b[1;1H\u001b[38;5;46m").Append(headerText).Append("\u001b[K");
        }
        if (topRow >= 3 && !string.IsNullOrEmpty(subHeaderText))
        {
            sb.Append("\u001b[2;1H\u001b[38;5;244m").Append(subHeaderText).Append("\u001b[K");
        }

        for (int row = 0; row < BH; row++)
        {
            sb.Append("\u001b[").Append(row + topRow).Append(";1H");
            int last = -1;
            for (int col = 0; col < W; col++)
            {
                int idx = row * W + col;
                if (zbuf[idx] == double.MaxValue) { sb.Append(' '); continue; }
                int lvl = (int)(bright[idx] * (Ramp.Length - 0.01));
                int[] pal = Pals[cpart[idx]];
                int pi = lvl * pal.Length / Ramp.Length;
                int color = pal[pi];
                if (color != last)
                {
                    sb.Append("\u001b[38;5;").Append(color).Append('m');
                    last = color;
                }
                sb.Append(Ramp[lvl]);
            }
            sb.Append("\u001b[0m");
        }

        if (!string.IsNullOrEmpty(bottomText))
        {
            sb.Append("\u001b[").Append(h).Append(";1H\u001b[38;5;51m").Append(bottomText).Append("\u001b[K\u001b[0m");
        }

        return sb.ToString();
    }
}
