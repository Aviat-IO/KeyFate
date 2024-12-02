import { NewSecretForm } from "@/components/forms/newSecretForm"

export default function NewSecretPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Create New Secret</h1>
      <div className="mx-auto max-w-2xl">
        <NewSecretForm />
      </div>
    </div>
  )
}
