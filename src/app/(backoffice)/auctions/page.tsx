import { redirect } from 'next/navigation'

export default function AuctionsPage() {
  redirect('/auctions/pending-bids')
}
