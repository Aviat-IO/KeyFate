import { NewSecretForm } from "@/components/forms/newSecretForm"

export default function NewSecretPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="mb-8 text-2xl font-bold text-left">Create New Secret</h1>
      <NewSecretForm />
    </div>
  )
}
