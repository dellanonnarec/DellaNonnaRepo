$ErrorActionPreference = "Stop"

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class DellaNonnaRawSpooler {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private class DOC_INFO_1 {
        public string pDocName;
        public string pOutputFile;
        public string pDatatype;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printer, IntPtr defaults);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int StartDocPrinter(IntPtr printer, int level, [In] DOC_INFO_1 documentInfo);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr printer);
    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr printer, byte[] buffer, int count, out int written);

    private static void Check(bool ok) {
        if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    public static int Print(string printerName, byte[] data) {
        IntPtr printer = IntPtr.Zero;
        int jobId = 0;
        bool documentStarted = false;
        bool pageStarted = false;
        Check(OpenPrinter(printerName, out printer, IntPtr.Zero));
        try {
            var info = new DOC_INFO_1 {
                pDocName = "Della Nonna - Cupom ESC POS",
                pOutputFile = null,
                pDatatype = "RAW"
            };
            jobId = StartDocPrinter(printer, 1, info);
            if (jobId == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
            documentStarted = true;
            Check(StartPagePrinter(printer));
            pageStarted = true;
            int written;
            if (!WritePrinter(printer, data, data.Length, out written)) {
                throw new Exception("PRINT_OUTCOME_UNKNOWN: " + new Win32Exception(Marshal.GetLastWin32Error()).Message);
            }
            if (written != data.Length) throw new Exception("PRINT_OUTCOME_UNKNOWN: o spooler recebeu apenas parte do cupom.");
            return jobId;
        } finally {
            if (pageStarted) EndPagePrinter(printer);
            if (documentStarted) EndDocPrinter(printer);
            if (printer != IntPtr.Zero) ClosePrinter(printer);
        }
    }
}
'@

try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($request.printerName)) { throw "PRINTER_NAME nao foi informado." }
    $bytes = [Convert]::FromBase64String($request.data)
    Add-Type -TypeDefinition $source
    $jobId = [DellaNonnaRawSpooler]::Print($request.printerName, $bytes)
    [Console]::Out.WriteLine("{""jobId"":$jobId,""bytes"":$($bytes.Length)}")
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
