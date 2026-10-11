import { useEffect, useState } from "react";
import { Container, Table, Card, Badge, Form, InputGroup } from "react-bootstrap"; // Added Form and InputGroup
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FiDownload } from "react-icons/fi";
import PageBreadcrumb from "@/components/PageBreadcrumb";

const DefectsList = () => {
    const [defects, setDefects] = useState([]);
    const [searchQuery, setSearchQuery] = useState(""); // State for search input

    useEffect(() => {
        const fetchDefects = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/defects");
                if (response.data.success) {
                    setDefects(response.data.data);
                }
            } catch (error) {
                console.error("Error fetching defect details:", error);
            }
        };

        fetchDefects();
    }, []);

    // Helper function to assign colors based on severity level
    const getSeverityBadge = (severity) => {
        if (!severity) return "secondary"; // Gray for N/A

        switch (severity.toLowerCase()) {
            case "high":
                return "danger"; // Yellow/Orange
            case "medium":
                return "info"; // Blue/Teal
            case "low":
                return "success"; // Green
            default:
                return "primary";
        }
    };

    // Filter defects based on the search query (UI side only)
    const filteredDefects = defects.filter((defect) => {
        const defectType = (defect.crack_type || defect.defect_type || "Unknown").replace(/_/g, ' ').toLowerCase();
        return defectType.includes(searchQuery.toLowerCase());
    });

    const downloadPDF = () => {
        const doc = new jsPDF();
        const tableRows = filteredDefects.map((defect) => [
            defect.camera_id || "N/A",
            (defect.crack_type || defect.defect_type || "Unknown").replace(/_/g, " "),
            defect.confidence ? `${(defect.confidence * 100).toFixed(1)}%` : "N/A",
            defect.severity ? defect.severity.toUpperCase() : "N/A",
            defect.timestamp || defect.detected_time || "N/A",
        ]);

        doc.setFontSize(16);
        doc.text("Defect Details", 14, 16);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);

        autoTable(doc, {
            head: [["Camera ID", "Defect Type", "Confidence", "Severity", "Detected Time"]],
            body: tableRows,
            startY: 29,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [52, 58, 64] },
        });

        doc.save(`defect-details-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <Container fluid>
            <PageBreadcrumb title="Defect Details" />

            <Card className="mt-4 shadow-sm">
                <Card.Body>
                    {/* Search Bar */}
                    <div className="mb-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            className="btn btn-primary d-inline-flex align-items-center gap-2"
                            onClick={downloadPDF}
                            disabled={filteredDefects.length === 0}
                        >
                            <FiDownload aria-hidden="true" />
                            Download PDF
                        </button>
                        <div style={{ maxWidth: "300px", width: "100%" }}>
                            <Form.Control
                                type="text"
                                placeholder="Search by Defect Type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <Table striped bordered hover responsive className="align-middle text-center">
                        <thead className="table-dark">
                            <tr>
                                <th>Camera ID</th>
                                <th>Defect Type</th>
                                <th>Confidence</th>
                                <th>Severity</th>
                                <th>Detected Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDefects.length > 0 ? (
                                filteredDefects.map((defect) => (
                                    <tr key={defect._id}>
                                        <td className="fw-bold text-muted">{defect.camera_id || "N/A"}</td>

                                        <td className="text-capitalize">
                                            {(defect.crack_type || defect.defect_type || "Unknown").replace(/_/g, ' ')}
                                        </td>

                                        <td>
                                            {defect.confidence ? `${(defect.confidence * 100).toFixed(1)}%` : "N/A"}
                                        </td>

                                        <td>
                                            <Badge bg={getSeverityBadge(defect.severity)} className="px-3 py-2">
                                                {defect.severity ? defect.severity.toUpperCase() : "N/A"}
                                            </Badge>
                                        </td>

                                        <td>
                                            {defect.timestamp || defect.detected_time || "N/A"}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center py-4 text-muted">
                                        {defects.length === 0 ? "Loading defects or no data found..." : "No matching defect types found."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default DefectsList;