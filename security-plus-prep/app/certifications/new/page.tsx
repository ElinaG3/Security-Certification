import Link from 'next/link';
import { CreateCertificationForm } from '@/components/CreateCertificationForm';

export default function NewCertificationPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/">&larr; Back to dashboard</Link>
      </p>
      <h1>Add a certification</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Creates the certification row and its domain weights/objectives. Once created, fill it exactly like Security+ was
        filled — ingest source PDFs, create cards manually, or run a batch generation script with
        <code> --certification-id</code>.
      </p>
      <CreateCertificationForm />
    </div>
  );
}
