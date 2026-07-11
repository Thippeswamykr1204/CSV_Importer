const SAMPLE_CSV = `Client Name,Contact No,Alt Contact,Email IDs,Company,Notes,Status,Assigned To,Project Interest,Enquiry Date
Ravi Kumar,9845012345,,ravi.kumar@gmail.com,,Interested in 3BHK near Sarjapur,hot lead call again,Anjali,Sarjapur Plots,2026-06-28
Priya S.,9900011122,9900099988,"priya@work.com, priya.s@gmail.com",Acme Consulting,Wants site visit next weekend,warm,Rahul,Meridian Tower,2026-06-29
,,,,Acme Builders,No contact info on this one,,,Eden Park,2026-06-30
John Mathew,+91 98765 43210,,john.mathew@hubspot-export.com,Mathew & Co,Ready to move possession preferred,SALE_DONE,Anjali,Varah Swamy,2026-07-01
`;

export async function GET() {
  return new Response(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="groweasy-sample-leads.csv"',
    },
  });
}
