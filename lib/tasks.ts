export interface Task {
  id: string
  title: string
  category: 'personal' | 'rental' | 'milestone'
  completed: boolean
  dueDate: string
  month: string
  notes?: string
}

export const MONTHS_ORDER = [
  'June 2026',
  'July 2026',
  'August 2026',
  'Future Projects',
]

export const initialTasks: Task[] = [
  // Milestones
  { id: '1', title: 'Offer accepted on property', category: 'milestone', completed: true, dueDate: 'Jun 3', month: 'June 2026' },
  { id: '2', title: 'Home inspection complete', category: 'milestone', completed: false, dueDate: 'Jun 10', month: 'June 2026' },
  { id: '3', title: 'Close on property', category: 'milestone', completed: false, dueDate: 'Jun 30', month: 'June 2026' },
  // Personal — June
  { id: '4', title: 'Walk through property with fresh eyes', category: 'personal', completed: false, dueDate: 'Jun 10', month: 'June 2026' },
  { id: '5', title: 'Transfer electricity to new ownership', category: 'personal', completed: false, dueDate: 'Jun', month: 'June 2026' },
  { id: '6', title: 'Set up WiFi', category: 'personal', completed: false, dueDate: 'Jun', month: 'June 2026' },
  { id: '7', title: 'Order 3 window AC units', category: 'personal', completed: false, dueDate: 'Jun 20', month: 'June 2026' },
  { id: '8', title: 'Deep clean entire cottage', category: 'personal', completed: false, dueDate: 'Jun 30', month: 'June 2026' },
  // Rental — June
  { id: '9', title: 'Verify Bear Lake Township STR rules', category: 'rental', completed: true, dueDate: 'Done', month: 'June 2026' },
  { id: '10', title: 'Get STR insurance quote (Proper Insurance)', category: 'rental', completed: false, dueDate: 'Jun 15', month: 'June 2026' },
  { id: '11', title: 'Set up homeowners insurance', category: 'rental', completed: false, dueDate: 'Jun 20', month: 'June 2026' },
  // Personal — July
  { id: '12', title: 'Install window AC units', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '13', title: 'Get hot tub quotes + select vendor', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '14', title: 'Hot tub installed 🛁', category: 'personal', completed: false, dueDate: 'Late Jul', month: 'July 2026' },
  { id: '15', title: 'Add washer & dryer', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '16', title: 'Outdoor living spaces (furniture, fire pit, string lights)', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '17', title: 'Organize / clear out old items', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '18', title: 'Bedroom refresh (bedding, decor)', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '19', title: 'Bathroom refresh', category: 'personal', completed: false, dueDate: 'Jul', month: 'July 2026' },
  // Rental — July
  { id: '20', title: 'Install STR lockbox for guest check-in', category: 'rental', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '21', title: 'Purchase guest supplies (linens x2, towels, kitchen)', category: 'rental', completed: false, dueDate: 'Jul', month: 'July 2026' },
  { id: '22', title: 'Set up cleaning protocol / service', category: 'rental', completed: false, dueDate: 'Late Jul', month: 'July 2026' },
  { id: '23', title: 'Professional photography for listing', category: 'rental', completed: false, dueDate: 'Late Jul', month: 'July 2026' },
  // Milestones — August
  { id: '24', title: 'First family stay! 🎉', category: 'milestone', completed: false, dueDate: 'Aug 1', month: 'August 2026' },
  // Personal — August
  { id: '25', title: 'Evaluate mini-split / HVAC options', category: 'personal', completed: false, dueDate: 'Aug', month: 'August 2026' },
  { id: '26', title: 'Add dishwasher', category: 'personal', completed: false, dueDate: 'Aug', month: 'August 2026' },
  { id: '27', title: 'Add video doorbell', category: 'personal', completed: false, dueDate: 'Aug', month: 'August 2026' },
  { id: '28', title: 'Add smart locks', category: 'personal', completed: false, dueDate: 'Aug', month: 'August 2026' },
  // Rental — August
  { id: '29', title: 'Develop welcome guide for STR guests', category: 'rental', completed: false, dueDate: 'Aug', month: 'August 2026' },
  { id: '30', title: 'Create and launch Airbnb listing', category: 'rental', completed: false, dueDate: 'Aug 1', month: 'August 2026' },
  { id: '31', title: 'Set pricing strategy (base, weekend, seasonal)', category: 'rental', completed: false, dueDate: 'Aug 1', month: 'August 2026' },
  { id: '32', title: 'First Airbnb guest! 🏡', category: 'milestone', completed: false, dueDate: 'TBD', month: 'August 2026' },
  // Future Projects
  { id: '33', title: 'Change ceiling tiles in bathroom', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '34', title: 'Add electric baseboards to basement', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '35', title: 'Change out hardware in kitchen & bathroom', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '36', title: 'Build storage in mudroom', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '37', title: 'Dock inspection & repairs', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '38', title: 'Outdoor patio build-out', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '39', title: 'Repaint deck', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '40', title: 'Add wiring to deck railing', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
  { id: '41', title: 'Paint & interior palette update', category: 'personal', completed: false, dueDate: 'TBD', month: 'Future Projects' },
]
