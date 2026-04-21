<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use ZipArchive;
use Illuminate\Support\Facades\Log;

class ReportExportController extends Controller
{
    /**
     * Generate a ZIP bundle of all major reports in CSV format.
     */
    public function downloadAll(Request $request, ReportsController $reports)
    {
        // Safety checks for ZIP support
        if (!class_exists('ZipArchive')) {
            return response()->json(['message' => 'ZIP extension not enabled on server.'], 500);
        }

        set_time_limit(0);

        $tempFile = tempnam(sys_get_temp_dir(), 'reports_');
        $zip = new ZipArchive();

        if ($zip->open($tempFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => 'Could not create temporary ZIP file.'], 500);
        }

        $filters = $request->only(['date_from', 'date_to', 'office_id', 'parent']);
        $filters['bucket'] = 'total'; // Use total metrics for CSV rows

        try {
            // Helper to fetch report data from ReportsController
            $fetch = function($method) use ($reports, $filters, $request) {
                $subRequest = Request::create("/api/reports/{$method}", 'GET', $filters);
                $subRequest->setUserResolver(fn() => $request->user());
                
                $response = $reports->$method($subRequest);
                if ($response instanceof \Illuminate\Http\JsonResponse) {
                    return $response->getData(true);
                }
                return [];
            };

            // 1. Approval & Compliance
            $approvalData = $fetch('approval');
            $zip->addFromString('01_approval_metrics_by_cluster.csv', $this->convertToCsv($approvalData['clusters'] ?? []));
            $zip->addFromString('02_office_compliance_summary.csv', $this->convertToCsv($approvalData['offices'] ?? []));

            // 2. Flow Health
            $healthData = $fetch('flowHealth');
            $zip->addFromString('03_returns_by_stage.csv', $this->convertToCsv($healthData['return_by_stage'] ?? []));
            $zip->addFromString('04_bottlenecks_by_office.csv', $this->convertToCsv($healthData['bottleneck'] ?? []));

            // 3. Document Requests
            $requestData = $fetch('requests');
            $zip->addFromString('05_request_kpis.csv', $this->convertToCsv([$requestData['kpis'] ?? []]));
            $zip->addFromString('06_request_office_acceptance.csv', $this->convertToCsv($requestData['office_acceptance'] ?? []));

            // 4. Activity Logs
            $activityData = $fetch('activity');
            $zip->addFromString('07_activity_distribution.csv', $this->convertToCsv($activityData['distribution'] ?? []));
            $zip->addFromString('08_top_activity_actors.csv', $this->convertToCsv($activityData['top_actors'] ?? []));

            $zip->close();

            $filename = 'FilDOCS_Master_Reports_' . now()->format('Y-m-d_His') . '.zip';
            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            if (isset($zip) && file_exists($tempFile)) {
                @$zip->close();
                @unlink($tempFile);
            }
            Log::error("Report Master Export Failed: " . $e->getMessage());
            return response()->json(['message' => 'Export failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Convert associative array to CSV string with UTF-8 BOM.
     */
    private function convertToCsv(array $data): string
    {
        if (empty($data)) {
             return "\xEF\xBB\xBF" . "No data available recorded for this period\n";
        }

        $output = fopen('php://temp', 'r+');
        
        // Add UTF-8 BOM for Excel
        fwrite($output, "\xEF\xBB\xBF");

        // Use the first row to determine headers
        $firstRow = reset($data);
        $headers = array_keys(is_array($firstRow) ? $firstRow : (array)$firstRow);
        fputcsv($output, $headers);

        // Content
        foreach ($data as $row) {
            $rowData = (array)$row;
            // Sanitize: replace any em-dash with standard hyphen for consistent encoding
            $rowData = array_map(function($val) {
                if (is_string($val)) {
                    return str_replace('—', '-', $val);
                }
                return $val;
            }, $rowData);
            fputcsv($output, $rowData);
        }

        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return $csv;
    }
}
