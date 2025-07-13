import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Crown } from "lucide-react"
import Link from "next/link"

interface PricingCardProps {
  title: string
  description: string
  price: string
  subtext?: string
  savingsText?: string
  features: string[]
  buttonText: string
  buttonHref: string
  isPopular?: boolean
  className?: string
}

export function PricingCard({
  title,
  description,
  price,
  subtext,
  savingsText,
  features,
  buttonText,
  buttonHref,
  isPopular = false,
  className = "",
}: PricingCardProps) {
  return (
    <Card className={`${isPopular ? "border-primary" : ""} ${className}`}>
      <CardHeader className="pb-8 text-center">
        <div className="flex items-center justify-center space-x-2">
          {isPopular && <Crown className="text-primary h-6 w-6" />}
          <CardTitle className="text-2xl">{title}</CardTitle>
          {isPopular && (
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Most Popular
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-foreground text-4xl font-bold">{price}</div>
          {subtext && (
            <p className="text-muted-foreground text-sm">{subtext}</p>
          )}
          {savingsText && (
            <p className="text-success text-sm font-medium">{savingsText}</p>
          )}
          <p className="text-muted-foreground">{description}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start space-x-3">
              <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
              <span className="text-foreground text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isPopular ? "default" : "outline"}
          asChild
        >
          <Link href={buttonHref}>{buttonText}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
