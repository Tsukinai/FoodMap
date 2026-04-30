import type { Restaurant } from '@/lib/types'
import AddPinModal from './AddPinModal'

interface Props {
  restaurant: Restaurant
  onClose: () => void
  onSaved: () => void
}

export default function EditPinModal({ restaurant, onClose, onSaved }: Props) {
  return <AddPinModal restaurant={restaurant} onClose={onClose} onSaved={onSaved} />
}
