"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Crown } from "lucide-react"
import {
  MESSAGE_TEMPLATES,
  MessageTemplate,
  getAllCategories,
} from "@/constants/message-templates"
import { useState } from "react"

interface MessageTemplateSelectorProps {
  onSelectTemplate: (content: string) => void
  isPro: boolean
  onUpgradeClick?: () => void
}

export function MessageTemplateSelector({
  onSelectTemplate,
  isPro,
  onUpgradeClick,
}: MessageTemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = getAllCategories()
  const filteredTemplates = selectedCategory
    ? MESSAGE_TEMPLATES.filter((t) => t.category === selectedCategory)
    : MESSAGE_TEMPLATES

  const handleSelectTemplate = (template: MessageTemplate) => {
    onSelectTemplate(template.content)
    setOpen(false)
  }

  if (!isPro) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onUpgradeClick}
        className="w-full gap-2"
      >
        <Crown className="h-4 w-4" />
        Message Templates (Pro)
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full gap-2">
          <FileText className="h-4 w-4" />
          Use Message Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Choose a pre-written template to customize for your secret
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="hover:border-primary hover:bg-accent w-full rounded-lg border p-4 text-left transition-colors"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{template.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
