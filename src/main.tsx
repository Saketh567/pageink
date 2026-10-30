import { render } from 'preact'
import './index.css'
import './atlas/atlas.css'
import { enablePenLog } from './debug/pen-log.ts'
import { App } from './ui/App.tsx'

enablePenLog()
render(<App />, document.getElementById('app')!)
