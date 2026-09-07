param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [ValidateSet('capture', 'clipboard')][string]$Mode = 'capture'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ($Mode -eq 'clipboard') {
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -eq $image) { exit 0 }
    try { $image.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $image.Dispose() }
    exit 0
}

# 单个临时屏幕选区覆盖层；没有编辑器标签或识别面板。
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public class SilkRegionCapture : Form {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    Bitmap screen;
    Point start;
    Rectangle selection;
    bool dragging;
    string output;
    public bool Saved;
    public SilkRegionCapture(string path) {
        output = path;
        Rectangle bounds = SystemInformation.VirtualScreen;
        screen = new Bitmap(bounds.Width, bounds.Height);
        using (Graphics g = Graphics.FromImage(screen)) g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        AutoScaleMode = AutoScaleMode.None;
        Bounds = bounds;
        TopMost = true; ShowInTaskbar = false; KeyPreview = true; DoubleBuffered = true;
        Cursor = Cursors.Cross;
    }
    protected override void OnPaint(PaintEventArgs e) {
        e.Graphics.DrawImageUnscaled(screen, 0, 0);
        using (Brush shade = new SolidBrush(Color.FromArgb(90, 0, 0, 0))) e.Graphics.FillRectangle(shade, ClientRectangle);
        if (selection.Width > 0 && selection.Height > 0) {
            e.Graphics.DrawImage(screen, selection, selection, GraphicsUnit.Pixel);
            using (Pen pen = new Pen(Color.FromArgb(100, 180, 255), 2)) e.Graphics.DrawRectangle(pen, selection);
        }
    }
    protected override void OnMouseDown(MouseEventArgs e) {
        if (e.Button == MouseButtons.Right) { Close(); return; }
        if (e.Button != MouseButtons.Left) return;
        start = e.Location; dragging = true; Capture = true;
    }
    protected override void OnMouseMove(MouseEventArgs e) {
        if (!dragging) return;
        Point p = new Point(Math.Max(0, Math.Min(ClientSize.Width, e.X)), Math.Max(0, Math.Min(ClientSize.Height, e.Y)));
        selection = Rectangle.FromLTRB(Math.Min(start.X, p.X), Math.Min(start.Y, p.Y), Math.Max(start.X, p.X), Math.Max(start.Y, p.Y));
        Invalidate();
    }
    protected override void OnMouseUp(MouseEventArgs e) {
        if (!dragging || e.Button != MouseButtons.Left) return;
        OnMouseMove(e); dragging = false; Capture = false;
        if (selection.Width < 4 || selection.Height < 4) { Invalidate(); return; }
        using (Bitmap crop = screen.Clone(selection, PixelFormat.Format32bppArgb)) crop.Save(output, ImageFormat.Png);
        Saved = true; Close();
    }
    protected override void OnKeyDown(KeyEventArgs e) {
        if (e.KeyCode == Keys.Escape) Close();
        if (e.Control && e.KeyCode == Keys.V) {
            using (Image image = Clipboard.GetImage()) {
                if (image != null) { image.Save(output, ImageFormat.Png); Saved = true; Close(); }
            }
        }
    }
    protected override void Dispose(bool disposing) {
        if (disposing && screen != null) { screen.Dispose(); screen = null; }
        base.Dispose(disposing);
    }
}
'@
[SilkRegionCapture]::SetProcessDPIAware() | Out-Null
$capture = New-Object SilkRegionCapture($OutputPath)
try {
    $capture.ShowDialog() | Out-Null
    if (-not $capture.Saved) { exit 2 }
}
finally { $capture.Dispose() }
